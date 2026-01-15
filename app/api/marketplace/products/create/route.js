import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { PRODUCT_ID_REGEX, generateUniqueProductId } from "../../../../lib/products/productId";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

const REQUIRED_R2_ENV = [
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_PUBLIC_URL",
];

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

const sanitizeFilename = (filename) => {
  return (
    filename
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/\.[^.]+$/, "") + ".webp"
  );
};

const sanitizeProductFilename = (filename) => {
  return filename
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
};

const deleteR2ObjectByKey = async (key) => {
  if (!key) return;
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
    })
  );
};

const getR2KeyFromPublicUrl = (url) => {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (!base || !url) return null;
  const normalizedBase = String(base).replace(/\/+$/, "");
  const normalizedUrl = String(url);
  if (!normalizedUrl.startsWith(`${normalizedBase}/`)) return null;
  return normalizedUrl.slice(normalizedBase.length + 1);
};

const parseFileSizeBytesFromString = (value) => {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return 0;
  const match = raw.match(/^([\d.]+)\s*(Bytes|KB|MB|GB)$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return 0;
  const unit = match[2].toUpperCase();
  const multipliers = { BYTES: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return Math.round(num * (multipliers[unit] || 1));
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Calculate content_length enum based on file type and size
 * Estimates reading time from file characteristics
 * @param {string} fileType - The type of file (PDF, DOCX, EPUB, Video, Audio, etc.)
 * @param {number} fileSizeBytes - The file size in bytes
 * @returns {string} - One of: quick_read, medium_read, long_read, comprehensive_guide
 */
const calculateContentLength = (fileType, fileSizeBytes) => {
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return "quick_read";
  }

  const fileSizeKB = fileSizeBytes / 1024;
  const fileSizeMB = fileSizeKB / 1024;
  const normalizedFileType = (fileType || "").toUpperCase();

  let estimatedMinutes = 0;

  // Text-based documents (PDF, DOCX, EPUB, etc.)
  if (["PDF", "DOCX", "DOC", "EPUB", "TXT", "RTF", "ODT"].includes(normalizedFileType)) {
    // Estimate: ~3KB per page for text-heavy PDFs, ~300 words per page, ~200 words per minute reading speed
    const estimatedPages = fileSizeKB / 3;
    const estimatedWords = estimatedPages * 300;
    estimatedMinutes = estimatedWords / 200;
  }
  // Spreadsheets and templates
  else if (["GOOGLE SHEETS", "XLSX", "XLS", "CSV", "NOTION TEMPLATE"].includes(normalizedFileType)) {
    // Templates are usually quick to set up but may take time to customize
    // Estimate based on complexity (size as proxy)
    if (fileSizeMB < 0.5) estimatedMinutes = 15;
    else if (fileSizeMB < 2) estimatedMinutes = 45;
    else if (fileSizeMB < 5) estimatedMinutes = 90;
    else estimatedMinutes = 180;
  }
  // Video content
  else if (["VIDEO", "MP4", "MOV", "AVI", "MKV", "WEBM"].includes(normalizedFileType)) {
    // Estimate: ~10MB per minute for compressed video
    estimatedMinutes = fileSizeMB / 10;
  }
  // Audio content
  else if (["AUDIO", "MP3", "WAV", "AAC", "FLAC", "OGG"].includes(normalizedFileType)) {
    // Estimate: ~1MB per minute for compressed audio
    estimatedMinutes = fileSizeMB / 1;
  }
  // ZIP/Archive files - assume contains documentation
  else if (["ZIP", "RAR", "7Z", "TAR", "GZ"].includes(normalizedFileType)) {
    // For archives, estimate based on size - assume mixed content
    if (fileSizeMB < 5) estimatedMinutes = 30;
    else if (fileSizeMB < 20) estimatedMinutes = 60;
    else if (fileSizeMB < 50) estimatedMinutes = 120;
    else estimatedMinutes = 240;
  }
  // Default fallback
  else {
    // Use size-based heuristic
    if (fileSizeMB < 1) estimatedMinutes = 15;
    else if (fileSizeMB < 5) estimatedMinutes = 45;
    else if (fileSizeMB < 20) estimatedMinutes = 90;
    else estimatedMinutes = 180;
  }

  // Map estimated minutes to content_length enum
  if (estimatedMinutes < 30) {
    return "quick_read";
  } else if (estimatedMinutes < 60) {
    return "medium_read";
  } else if (estimatedMinutes < 180) {
    return "long_read";
  } else {
    return "comprehensive_guide";
  }
};

export async function POST(request) {
  let uploadedKeys = [];
  let uploadedProductKey = null;
  let session;
  const requestId = getRequestIdFromHeaders(request?.headers) || null;

  try {
    if (REQUIRED_R2_ENV.some((k) => !process.env[k])) {
      return NextResponse.json(
        { status: "error", message: "Uploads unavailable. Please retry shortly." },
        { status: 503 }
      );
    }

    // Process form data
    const formData = await request.formData();

    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

    uploadedKeys = [];
    uploadedProductKey = null;

    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Authentication required",
        },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userId = String(session.user.id);
    const rl = rateLimit({ key: `product-create:${userId}:${ip}`, limit: 10, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    // userId already derived from session
    const userIdFromForm = formData.get("user_id");
    if (userIdFromForm && String(userIdFromForm) !== userId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Unauthorized",
        },
        { status: 403 }
      );
    }

    const resolvedCurrency = "USD";

    // Extract product data directly from form fields
    const productData = {
      title: formData.get("title"),
      description: formData.get("description"),
      price: parseFloat(formData.get("price")),
      currency: resolvedCurrency,
      originalPrice: formData.get("originalPrice")
        ? parseFloat(formData.get("originalPrice"))
        : null,
      marketplace_category_id: formData.get("marketplace_category_id"),
      marketplace_subcategory_id: formData.get("marketplace_subcategory_id"),
      fileType: formData.get("fileType"),
      fileSize: formData.get("fileSize") || "",
      license: formData.get("license") || "Standard",
      deliveryTime: formData.get("deliveryTime") || "Instant",
      what_included: formData.get("what_included") || "",
    };

    const rawProductIdInput = formData.get("product_id");
    const productIdInput =
      typeof rawProductIdInput === "string" ? rawProductIdInput.trim() : "";
    if (productIdInput && !PRODUCT_ID_REGEX.test(productIdInput)) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Invalid product ID format. Use 8 or 10 alphanumeric characters.",
        },
        { status: 400 }
      );
    }

    const rawProductStatus = formData.get("product_status");
    const productStatus = rawProductStatus ? String(rawProductStatus).trim() : "";
    const resolvedProductStatus = productStatus || "draft";
    if (!['draft', 'published', 'archived'].includes(resolvedProductStatus)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid product status",
        },
        { status: 400 }
      );
    }

    const rawSaleEndDate = formData.get("sale_end_date");
    const saleEndDateStr = rawSaleEndDate == null ? "" : String(rawSaleEndDate).trim();
    let sale_end_date = null;
    if (saleEndDateStr) {
      const d = new Date(saleEndDateStr);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          {
            status: "error",
            message: "Invalid sale end date",
          },
          { status: 400 }
        );
      }
      sale_end_date = d;
    }

    const hasDiscount =
      Number.isFinite(productData.price) &&
      Number.isFinite(productData.originalPrice) &&
      productData.price < productData.originalPrice;

    productData.product_status = resolvedProductStatus;
    productData.sale_end_date = hasDiscount ? sale_end_date : null;

    // Parse stock
    const stockRaw = formData.get("stock");
    const stock =
      stockRaw !== null && stockRaw !== undefined && stockRaw !== ""
        ? parseInt(stockRaw, 10)
        : null;

    if (stock !== null && (Number.isNaN(stock) || stock < 0)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Stock must be a non-negative integer",
        },
        { status: 400 }
      );
    }

    // Validate price relationship originalPrice >= price when provided
    if (
      productData.originalPrice !== null &&
      typeof productData.price === "number" &&
      productData.originalPrice < productData.price
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Original price must be greater than or equal to sale price",
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (
      !productData.title ||
      !productData.description ||
      !productData.price ||
      !productData.marketplace_category_id ||
      !productData.marketplace_subcategory_id
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing required product information",
        },
        { status: 400 }
      );
    }

    // Get image files from form data
    let imageFiles = formData.getAll("images");
    
    // Get product file from form data
    const productFile = formData.get("productFile");
    console.log("Image files received:", imageFiles);
    console.log("Images from form details:", {
      count: imageFiles.length,
      types: imageFiles.map(f => typeof f),
      objectKeys: imageFiles.length > 0 ? Object.keys(imageFiles[0] || {}) : [],
      hasFiles: imageFiles.some(f => f instanceof File || f instanceof Blob),
      fileDetails: imageFiles.map(file => ({
        type: typeof file,
        name: file?.name,
        size: file?.size,
        contentType: file?.type,
        hasArrayBuffer: typeof file?.arrayBuffer === 'function',
        isFormData: file instanceof FormData,
        constructor: file?.constructor?.name
      }))
    });
    
    let imageUrls = [];

    const maxTotalImageSize = 3 * 1024 * 1024;
    const maxSingleImageSize = 3 * 1024 * 1024;

    const hasFileObjects = imageFiles.length > 0 && imageFiles[0] instanceof File;
    if (hasFileObjects) {
      const totalImageSize = imageFiles.reduce((sum, file) => {
        if (file && typeof file.size === "number") return sum + file.size;
        return sum;
      }, 0);

      if (totalImageSize > maxTotalImageSize) {
        return NextResponse.json(
          {
            status: "error",
            message: "Total images size must be less than 3MB",
          },
          { status: 413 }
        );
      }

      const oversize = imageFiles.find(
        (file) => file && typeof file.size === "number" && file.size > maxSingleImageSize
      );
      if (oversize) {
        return NextResponse.json(
          {
            status: "error",
            message: `Image ${oversize.name} must be 3MB or less`,
          },
          { status: 413 }
        );
      }
    }
    
    if (!hasFileObjects) {
      // If no actual file objects, check for image URLs as JSON string
      const imageUrlsJson = formData.get("imageUrls") || formData.get("images");
      
      if (imageUrlsJson) {
        try {
          if (typeof imageUrlsJson === "string") {
            // Try to parse as JSON
            try {
              imageUrls = JSON.parse(imageUrlsJson);
            } catch {
              // If not valid JSON, treat as a single URL
              imageUrls = [imageUrlsJson];
            }
          } else if (Array.isArray(imageUrlsJson)) {
            imageUrls = imageUrlsJson;
          }
        } catch (error) {
          await reportError(error, {
            route: "/api/marketplace/products/create",
            method: "POST",
            status: 400,
            requestId,
            userId: session?.user?.id || null,
            tag: "product_create",
            extra: { stage: "parse_image_urls" },
          });
        }
      }
    }

    if (!hasFileObjects) {
      const base = String(publicUrlBase).replace(/\/+$/, "");
      const expectedPrefix = `${base}/marketplace/uploads/${userId}/images/`;
      const rawUrls = Array.isArray(imageUrls) ? imageUrls : [];
      const filtered = Array.from(new Set(rawUrls))
        .filter((u) => typeof u === "string" && u.startsWith(expectedPrefix));
      imageUrls = filtered;
      uploadedKeys = imageUrls
        .map((u) => getR2KeyFromPublicUrl(u))
        .filter(Boolean);
    }

    // Upload product file to Cloudflare R2 if provided
    let productFileUrl = null;
    let calculatedFileSize = "";
    let productFileBytes = 0;
    const productFileUrlFromForm = formData.get("productFileUrl");
    const isDirectProductFile =
      !productFile && typeof productFileUrlFromForm === "string" && productFileUrlFromForm;
    
    if (isDirectProductFile) {
      const base = String(publicUrlBase).replace(/\/+$/, "");
      const expectedPrefix = `${base}/marketplace/uploads/${userId}/files/`;
      if (!String(productFileUrlFromForm).startsWith(expectedPrefix)) {
        return NextResponse.json(
          {
            status: "error",
            message: "Invalid product file",
          },
          { status: 400 }
        );
      }
      productFileUrl = String(productFileUrlFromForm);
      uploadedProductKey = getR2KeyFromPublicUrl(productFileUrl);
      calculatedFileSize = productData.fileSize || "";
      productFileBytes = parseFileSizeBytesFromString(calculatedFileSize);
    } else if (productFile && productFile.size > 0) {
      try {
        // Validate file size (max 25MB)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (productFile.size > maxSize) {
          return NextResponse.json(
            {
              status: "error",
              message: "Product file size must be 25MB or less",
            },
            { status: 413 }
          );
        }
        
        // Calculate file size
        calculatedFileSize = formatFileSize(productFile.size);
        productFileBytes = productFile.size;
        
        // Generate unique filename
        const fileCode = randomImageName();
        const sanitizedName = sanitizeProductFilename(productFile.name);
        const fileName = `marketplace/files/${fileCode}_${sanitizedName}`;
        uploadedProductKey = fileName;
        
        // Convert file to buffer
        let buffer;
        if (typeof productFile.arrayBuffer === 'function') {
          const arrayBuffer = await productFile.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else {
          throw new Error('Unable to read product file data');
        }
        
        // Upload to Cloudflare R2
        const s3Params = {
          Bucket: bucketName,
          Key: fileName,
          Body: buffer,
          ContentType: productFile.type || 'application/octet-stream',
        };
        
        const command = new PutObjectCommand(s3Params);
        await s3Client.send(command);
        
        // Create public URL for the uploaded file
        productFileUrl = `${publicUrlBase}/${fileName}`;
        
        console.log("Product file uploaded successfully:", {
          originalName: productFile.name,
          size: calculatedFileSize,
          url: productFileUrl
        });
        
      } catch (error) {
        await reportError(error, {
          route: "/api/marketplace/products/create",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_create",
          extra: { stage: "upload_product_file" },
        });
        try {
          if (uploadedProductKey) await deleteR2ObjectByKey(uploadedProductKey);
        } catch (cleanupError) {
          await reportError(cleanupError, {
            route: "/api/marketplace/products/create",
            method: "POST",
            status: 500,
            requestId,
            userId: session?.user?.id || null,
            tag: "product_create",
            extra: { stage: "cleanup_product_file" },
          });
        }
        return NextResponse.json(
          {
            status: "error",
            message: "Failed to upload product file",
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        {
          status: "error",
          message: "Product file is required",
        },
        { status: 400 }
      );
    }

    // Upload images to Cloudflare R2 if there are files
    let featuredImageUrl = null;
    console.log("Before image upload check:", { hasFiles: imageFiles && imageFiles.length > 0, hasValidSize: imageFiles && imageFiles.length > 0 && imageFiles[0].size > 0 });

    if (imageFiles && imageFiles.length > 0 && imageFiles[0].size > 0) {
      // Process each image file
      for (const file of imageFiles) {
        try {
          const imagecode = randomImageName();
          // Use name property instead of originalname - browser File objects use name
          const originalname = sanitizeFilename(file.name);

          // Convert file to buffer with error handling
          let buffer;
          try {
            // For File objects from the browser
            if (typeof file.arrayBuffer === 'function') {
              const arrayBuffer = await file.arrayBuffer();
              buffer = Buffer.from(arrayBuffer);
            } 
            // For Blob objects or other types
            else if (file.stream) {
              const chunks = [];
              for await (const chunk of file.stream()) {
                chunks.push(Buffer.from(chunk));
              }
              buffer = Buffer.concat(chunks);
            }
            // If all else fails, try to read as a stream
            else if (file.buffer) {
              buffer = file.buffer;
            } else {
              throw new Error('Unable to read file data');
            }
          } catch (bufferError) {
            throw new Error('Failed to process file buffer');
          }

          // Process image with sharp
          const compressedBuffer = await sharp(buffer)
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .toFormat("webp")
            .webp({ quality: 80, lossless: false, effort: 4 })
            .toBuffer();

          // Generate unique filename
          const fileName = `marketplace/${imagecode}.${originalname}`;
          uploadedKeys.push(fileName);

          // Upload to Cloudflare R2
          const s3Params = {
            Bucket: bucketName,
            Key: fileName,
            Body: compressedBuffer,
            ContentType: "image/webp",
          };

          const command = new PutObjectCommand(s3Params);
          await s3Client.send(command);

          // Create public URL for the uploaded image
          const imageUrl = `${publicUrlBase}/${fileName}`;
          imageUrls.push(imageUrl);
        } catch (error) {
          await reportError(error, {
            route: "/api/marketplace/products/create",
            method: "POST",
            status: 500,
            requestId,
            userId: session?.user?.id || null,
            tag: "product_create",
            extra: { stage: "upload_image", fileName: file?.name || null },
          });
          // Continue with other files if one fails
        }
      }

      // Set the first image as featured if requested
      if (imageUrls.length > 0) {
        featuredImageUrl = imageUrls[0];
      }

      // If no images were successfully uploaded, return error
      if (imageUrls.length === 0) {
        try {
          if (uploadedProductKey) await deleteR2ObjectByKey(uploadedProductKey);
          if (uploadedKeys.length) {
            await Promise.all(uploadedKeys.map((key) => deleteR2ObjectByKey(key)));
          }
        } catch (cleanupError) {
          await reportError(cleanupError, {
            route: "/api/marketplace/products/create",
            method: "POST",
            status: 500,
            requestId,
            userId: session?.user?.id || null,
            tag: "product_create",
            extra: { stage: "cleanup_failed_upload" },
          });
        }
        return NextResponse.json(
          { message: "Failed to upload images", status: "error" },
          { status: 500 }
        );
      }
    }

    if (imageUrls.length === 0) {
      try {
        if (uploadedProductKey) await deleteR2ObjectByKey(uploadedProductKey);
      } catch (cleanupError) {
        await reportError(cleanupError, {
          route: "/api/marketplace/products/create",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_create",
          extra: { stage: "cleanup_product_file_no_images" },
        });
      }
      return NextResponse.json(
        {
          status: "error",
          message: "At least one image is required",
        },
        { status: 400 }
      );
    }

    // Calculate content_length based on file type and size
    const contentLength = calculateContentLength(
      productData.fileType,
      productFileBytes
    );

    let createdProduct;
    let lastError;
    const maxAttempts = productIdInput ? 4 : 3;
    const triedIds = new Set();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const productId =
        attempt === 0 && productIdInput
          ? productIdInput
          : await generateUniqueProductId();
      if (triedIds.has(productId)) {
        continue;
      }
      triedIds.add(productId);
      try {
        createdProduct = await db.MarketplaceProduct.create({
          ...productData,
          user_id: userId,
          images: imageUrls,
          image: imageUrls[0] || null,
          file: productFileUrl, // Store the uploaded file URL
          fileType: productData.fileType,
          fileSize: calculatedFileSize || productData.fileSize || "", // Use calculated size
          license: productData.license || "Standard",
          deliveryTime: productData.deliveryTime || "Instant",
          what_included: productData.what_included || "",
          product_id: productId,
          stock: stock,
          inStock: stock === null ? true : stock > 0,
          content_length: contentLength,
        });
        lastError = undefined;
        break;
      } catch (e) {
        if (
          e?.name === "SequelizeUniqueConstraintError" ||
          e?.parent?.code === "23505"
        ) {
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    if (!createdProduct) {
      try {
        if (uploadedProductKey) await deleteR2ObjectByKey(uploadedProductKey);
        if (uploadedKeys.length) {
          await Promise.all(uploadedKeys.map((key) => deleteR2ObjectByKey(key)));
        }
      } catch (cleanupError) {
        await reportError(cleanupError, {
          route: "/api/marketplace/products/create",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_create",
          extra: { stage: "cleanup_failed_product_create" },
        });
      }
      throw lastError || new Error("Failed to create product with unique product_id");
    }

    let successMessage = "Product created successfully";
    if (resolvedProductStatus === "published") {
      const user = await db.User.findOne({
        where: { id: userId },
        attributes: ["id", "role", "crowdpen_staff", "merchant"],
        raw: true,
      });

      const kyc = await db.MarketplaceKycVerification.findOne({
        where: { user_id: userId },
        attributes: ["status"],
        raw: true,
      });

      const isApproved =
        kyc?.status === "approved" ||
        db.User.isKycExempt(user) ||
        user?.merchant === true;

      if (isApproved) {
        successMessage = "Product published successfully";
      } else if (kyc) {
        successMessage = "Product will be published after your KYC is approved";
      } else {
        successMessage = "Your product will be published after you submit your KYC";
      }
    }

    return NextResponse.json(
      {
        status: "success",
        message: successMessage,
        data: {
          id: createdProduct.id,
          title: createdProduct.title,
          image: createdProduct.image,
          images: createdProduct.images,
          product_id: createdProduct.product_id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/create",
      method: "POST",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "product_create",
      extra: { stage: "unhandled" },
    });

    try {
      if (uploadedProductKey) await deleteR2ObjectByKey(uploadedProductKey);
      if (uploadedKeys.length) {
        await Promise.all(uploadedKeys.map((key) => deleteR2ObjectByKey(key)));
      }
    } catch (cleanupError) {
      await reportError(cleanupError, {
        route: "/api/marketplace/products/create",
        method: "POST",
        status: 500,
        requestId,
        userId: session?.user?.id || null,
        tag: "product_create",
        extra: { stage: "cleanup_after_create_failure" },
      });
    }

    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to create product"
          : (error?.message || "Failed to create product"),
      },
      { status: 500 }
    );
  }
}
