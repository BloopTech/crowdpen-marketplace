import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { Op } from "sequelize";
import { validate as isUUID } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../lib/security/rateLimit";
import { ensureProductHasProductId } from "../../../../../lib/products/productId";
import { getRequestIdFromHeaders, reportError } from "../../../../../lib/observability/reportError";

export const runtime = "nodejs";

const REQUIRED_R2_ENV = [
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_PUBLIC_URL",
];

const { MarketplaceProduct } = db;

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
  return filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
};

const getR2KeyFromPublicUrl = (url) => {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (!base || !url) return null;
  const normalizedBase = String(base).replace(/\/+$/, "");
  const normalizedUrl = String(url);
  if (!normalizedUrl.startsWith(`${normalizedBase}/`)) return null;
  return normalizedUrl.slice(normalizedBase.length + 1);
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

const uniqueStrings = (arr) => {
  const out = [];
  const seen = new Set();
  for (const val of arr || []) {
    if (typeof val !== "string") continue;
    if (seen.has(val)) continue;
    seen.add(val);
    out.push(val);
  }
  return out;
};

const parseFileSizeBytesFromString = (value) => {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return 0;
  const match = raw.match(/^([\d.]+)\s*(Bytes|KB|MB|GB)$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return 0;
  const unit = match[2].toUpperCase();
  const multipliers = {
    BYTES: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };
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
    const estimatedPages = fileSizeKB / 3;
    const estimatedWords = estimatedPages * 300;
    estimatedMinutes = estimatedWords / 200;
  }
  // Spreadsheets and templates
  else if (["GOOGLE SHEETS", "XLSX", "XLS", "CSV", "NOTION TEMPLATE"].includes(normalizedFileType)) {
    if (fileSizeMB < 0.5) estimatedMinutes = 15;
    else if (fileSizeMB < 2) estimatedMinutes = 45;
    else if (fileSizeMB < 5) estimatedMinutes = 90;
    else estimatedMinutes = 180;
  }
  // Video content
  else if (["VIDEO", "MP4", "MOV", "AVI", "MKV", "WEBM"].includes(normalizedFileType)) {
    estimatedMinutes = fileSizeMB / 10;
  }
  // Audio content
  else if (["AUDIO", "MP3", "WAV", "AAC", "FLAC", "OGG"].includes(normalizedFileType)) {
    estimatedMinutes = fileSizeMB / 1;
  }
  // ZIP/Archive files
  else if (["ZIP", "RAR", "7Z", "TAR", "GZ"].includes(normalizedFileType)) {
    if (fileSizeMB < 5) estimatedMinutes = 30;
    else if (fileSizeMB < 20) estimatedMinutes = 60;
    else if (fileSizeMB < 50) estimatedMinutes = 120;
    else estimatedMinutes = 240;
  }
  // Default fallback
  else {
    if (fileSizeMB < 1) estimatedMinutes = 15;
    else if (fileSizeMB < 5) estimatedMinutes = 45;
    else if (fileSizeMB < 20) estimatedMinutes = 90;
    else estimatedMinutes = 180;
  }

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

export async function GET(request, { params }) {
  let getParams = null;
  try {
    getParams = await params;
  } catch {
    getParams = null;
  }
  const { id } = getParams || {};
  try {
    // Add your GET logic here
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/[id]/edit",
      method: "GET",
      status: 500,
      requestId: getRequestIdFromHeaders(request?.headers) || null,
      userId: null,
      tag: "product_edit",
      extra: { stage: "unhandled" },
    });
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  let session;
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  try {
    if (REQUIRED_R2_ENV.some((k) => !process.env[k])) {
      return NextResponse.json(
        { status: "error", message: "Uploads unavailable. Please retry shortly." },
        { status: 503 }
      );
    }

    let id;
    try {
      ({ id } = await params);
    } catch {
      id = null;
    }

    // Process form data
    const formData = await request.formData();

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
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `product-edit:${userIdForRl}:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const user_id = String(session.user.id);
    const userIdFromForm = formData.get("user_id");
    if (userIdFromForm && String(userIdFromForm) !== user_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Unauthorized",
        },
        { status: 403 }
      );
    }

    const idRaw = id == null ? "" : String(id).trim();
    if (!idRaw || idRaw.length > 128) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid product ID",
        },
        { status: 400 }
      );
    }

    // Verify product ownership
    const existingProduct = await MarketplaceProduct.findOne({
      where: {
        user_id,
        [db.Sequelize.Op.or]: (() => {
          const ors = [{ product_id: idRaw }];
          if (isUUID(idRaw)) {
            ors.unshift({ id: idRaw });
          }
          return ors;
        })(),
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product not found or access denied",
        },
        { status: 404 }
      );
    }

    const ensuredProductId = await ensureProductHasProductId(existingProduct);
    const formProductId = formData.get("productId");
    const normalizedFormProductId =
      typeof formProductId === "string" ? formProductId.trim() : "";
    if (
      normalizedFormProductId &&
      normalizedFormProductId !== ensuredProductId &&
      normalizedFormProductId !== String(existingProduct.id)
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid product ID",
        },
        { status: 400 }
      );
    }

    // Extract product data from form fields
    const productData = {
      title: formData.get("title"),
      description: formData.get("description"),
      price: parseFloat(formData.get("price")),
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

    // Handle images - both existing and new
    let finalImages = [];
    let mainImage = null;

    const previousImages = (() => {
      const imgs = [];
      if (existingProduct?.image) imgs.push(existingProduct.image);
      if (existingProduct?.images) {
        if (Array.isArray(existingProduct.images)) {
          imgs.push(...existingProduct.images);
        } else if (typeof existingProduct.images === "string") {
          try {
            const parsed = JSON.parse(existingProduct.images);
            if (Array.isArray(parsed)) imgs.push(...parsed);
          } catch {
            // ignore
          }
        }
      }
      return uniqueStrings(imgs);
    })();

    // Get existing images
    const existingImagesJson = formData.get("existingImages");
    if (existingImagesJson) {
      try {
        const existingImages = JSON.parse(existingImagesJson);
        if (Array.isArray(existingImages)) {
          finalImages = [...existingImages];
        }
      } catch (e) {
        await reportError(e, {
          route: "/api/marketplace/products/[id]/edit",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_edit",
          extra: { stage: "parse_existing_images" },
        });
      }
    }

    const imageUrlsJson = formData.get("imageUrls");
    if (imageUrlsJson) {
      try {
        const parsed =
          typeof imageUrlsJson === "string" ? JSON.parse(imageUrlsJson) : null;
        if (Array.isArray(parsed)) {
          const base = String(process.env.CLOUDFLARE_R2_PUBLIC_URL || "").replace(
            /\/+$/,
            ""
          );
          const expectedPrefix = `${base}/marketplace/uploads/${user_id}/images/`;
          const filtered = parsed.filter(
            (u) => typeof u === "string" && u.startsWith(expectedPrefix)
          );
          finalImages.push(...filtered);
        }
      } catch (e) {
        await reportError(e, {
          route: "/api/marketplace/products/[id]/edit",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_edit",
          extra: { stage: "parse_image_urls" },
        });
      }
    }

    finalImages = uniqueStrings(finalImages);

    // Get new image files from form data
    const newImageFiles = formData.getAll("images");

    // Process new images if any
    if (newImageFiles && newImageFiles.length > 0) {
      const maxSingleImageSize = 3 * 1024 * 1024;
      const maxTotalImageSize = 3 * 1024 * 1024; // 3MB total across all images
      const totalNewImageSize = newImageFiles.reduce((sum, file) => {
        if (file && typeof file.size === "number") {
          return sum + file.size;
        }
        return sum;
      }, 0);

      if (totalNewImageSize > maxTotalImageSize) {
        return NextResponse.json(
          {
            status: "error",
            message: "Total images size must be less than 3MB",
          },
          { status: 413 }
        );
      }

      const oversize = newImageFiles.find(
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

      for (const imageFile of newImageFiles) {
        if (imageFile && imageFile.size > 0) {
          try {
            // Convert image to WebP and resize
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const processedBuffer = await sharp(buffer)
              .resize(800, 600, {
                fit: "inside",
                withoutEnlargement: true,
              })
              .webp({ quality: 85 })
              .toBuffer();

            // Generate unique filename
            const imageName = randomImageName();
            const sanitizedName = sanitizeFilename(imageName);

            const fileName = `marketplace/${imageName}.${sanitizedName}`;

            // Upload to Cloudflare R2
            const uploadCommand = new PutObjectCommand({
              Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
              Key: fileName,
              Body: processedBuffer,
              ContentType: "image/webp",
            });

            await s3Client.send(uploadCommand);

            // Construct the public URL
            const imageUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`;
            finalImages.push(imageUrl);
          } catch (error) {
            await reportError(error, {
              route: "/api/marketplace/products/[id]/edit",
              method: "POST",
              status: 500,
              requestId,
              userId: session?.user?.id || null,
              tag: "product_edit",
              extra: { stage: "process_image", imageName: imageFile?.name || null },
            });
            return NextResponse.json(
              {
                status: "error",
                message: `Failed to process image: ${imageFile.name}`,
              },
              { status: 500 }
            );
          }
        }
      }
    }

    // Validate that we have at least one image
    if (finalImages.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "At least one image is required",
        },
        { status: 400 }
      );
    }

    // Set main image and additional images
    mainImage = finalImages[0];
    const additionalImages = finalImages.slice(1);

    const imagesToDelete = (() => {
      const keep = new Set(finalImages);
      return previousImages.filter((url) => !keep.has(url));
    })();

    // Handle product file - both existing and new
    let finalProductFile = null;
    let finalFileSize = productData.fileSize;
    let finalFileType = productData.fileType;

    // Check for existing product file
    const existingProductFile = formData.get("existingProductFile");
    if (existingProductFile) {
      finalProductFile = existingProductFile;
    }

    const productFileUrl = formData.get("productFileUrl");
    if (typeof productFileUrl === "string" && productFileUrl) {
      const base = String(process.env.CLOUDFLARE_R2_PUBLIC_URL || "").replace(
        /\/+$/,
        ""
      );
      const expectedPrefix = `${base}/marketplace/uploads/${user_id}/files/`;
      if (String(productFileUrl).startsWith(expectedPrefix)) {
        finalProductFile = String(productFileUrl);
      } else {
        return NextResponse.json(
          { status: "error", message: "Invalid product file" },
          { status: 400 }
        );
      }
    }

    // Check for new product file (overrides existing)
    const newProductFile = formData.get("productFile");
    const previousProductFileUrl = existingProduct?.file ? String(existingProduct.file) : null;
    if (newProductFile && newProductFile.size > 0) {
      try {
        // Validate file size (max 25MB)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (newProductFile.size > maxSize) {
          return NextResponse.json(
            {
              status: "error",
              message: "Product file size must be 25MB or less",
            },
            { status: 413 }
          );
        }

        // Calculate and format file size
        finalFileSize = formatFileSize(newProductFile.size);

        // Detect file type based on extension
        const getFileType = (fileName) => {
          const extension = fileName.split(".").pop().toLowerCase();
          const fileTypeMap = {
            pdf: "PDF",
            psd: "PSD",
            ai: "AI",
            fig: "FIGMA",
            figma: "FIGMA",
            zip: "ZIP",
            doc: "DOC",
            docx: "DOC",
            xls: "XLS",
            xlsx: "XLS",
            ppt: "PPT",
            pptx: "PPT",
          };
          return fileTypeMap[extension] || "PDF";
        };

        finalFileType = getFileType(newProductFile.name);

        // Upload new product file
        const fileBuffer = Buffer.from(await newProductFile.arrayBuffer());
        const fileName = randomImageName();
        const sanitizedFileName = sanitizeProductFilename(newProductFile.name);

        const uploadCommand = new PutObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: `marketplace/files/${fileName}_${sanitizedFileName}`,
          Body: fileBuffer,
          ContentType: newProductFile.type || "application/octet-stream",
        });

        await s3Client.send(uploadCommand);

        // Construct the public URL
        finalProductFile = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/marketplace/files/${fileName}_${sanitizedFileName}`;
      } catch (error) {
        await reportError(error, {
          route: "/api/marketplace/products/[id]/edit",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_edit",
          extra: { stage: "process_product_file" },
        });
        return NextResponse.json(
          {
            status: "error",
            message: "Failed to process product file",
          },
          { status: 500 }
        );
      }
    }

    // Validate that we have a product file
    if (!finalProductFile) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product file is required",
        },
        { status: 400 }
      );
    }

    // Calculate content_length based on file type and size
    // Use new file size if uploaded, otherwise try to estimate from existing file size string
    let fileSizeBytes = 0;
    if (newProductFile && newProductFile.size > 0) {
      fileSizeBytes = newProductFile.size;
    } else if (finalFileSize) {
      fileSizeBytes = parseFileSizeBytesFromString(finalFileSize);
    }
    const contentLength = calculateContentLength(finalFileType, fileSizeBytes);

    // Update the product in the database
    const updatedProduct = await existingProduct.update({
      title: productData.title,
      description: productData.description,
      price: productData.price,
      currency: "USD",
      originalPrice: productData.originalPrice,
      product_status: resolvedProductStatus,
      sale_end_date: hasDiscount ? sale_end_date : null,
      marketplace_category_id: productData.marketplace_category_id,
      marketplace_subcategory_id: productData.marketplace_subcategory_id,
      image: mainImage,
      images: finalImages,
      file: finalProductFile,
      fileType: finalFileType,
      fileSize: finalFileSize,
      license: productData.license,
      deliveryTime: productData.deliveryTime,
      what_included: productData.what_included,
      stock: stock,
      inStock: stock === null ? existingProduct.inStock : stock > 0,
      content_length: contentLength,
    });

    try {
      const keys = imagesToDelete
        .map((url) => getR2KeyFromPublicUrl(url))
        .filter(Boolean);
      if (keys.length) {
        await Promise.all(keys.map((key) => deleteR2ObjectByKey(key)));
      }
    } catch (cleanupError) {
      await reportError(cleanupError, {
        route: "/api/marketplace/products/[id]/edit",
        method: "POST",
        status: 500,
        requestId,
        userId: session?.user?.id || null,
        tag: "product_edit",
        extra: { stage: "cleanup_removed_images" },
      });
    }

    if (newProductFile && newProductFile.size > 0 && previousProductFileUrl) {
      try {
        const oldKey = getR2KeyFromPublicUrl(previousProductFileUrl);
        if (oldKey) await deleteR2ObjectByKey(oldKey);
      } catch (cleanupError) {
        await reportError(cleanupError, {
          route: "/api/marketplace/products/[id]/edit",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_edit",
          extra: { stage: "cleanup_replaced_product_file" },
        });
      }
    }

    if (
      typeof productFileUrl === "string" &&
      productFileUrl &&
      previousProductFileUrl &&
      String(productFileUrl) !== String(previousProductFileUrl)
    ) {
      try {
        const oldKey = getR2KeyFromPublicUrl(previousProductFileUrl);
        if (oldKey) await deleteR2ObjectByKey(oldKey);
      } catch (cleanupError) {
        await reportError(cleanupError, {
          route: "/api/marketplace/products/[id]/edit",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "product_edit",
          extra: { stage: "cleanup_replaced_product_file" },
        });
      }
    }

    let successMessage = "Product updated successfully!";
    if (resolvedProductStatus === "published") {
      const user = await db.User.findOne({
        where: { id: user_id },
        attributes: ["id", "role", "crowdpen_staff", "merchant"],
        raw: true,
      });

      const kyc = await db.MarketplaceKycVerification.findOne({
        where: { user_id },
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
          id: updatedProduct.id,
          title: updatedProduct.title,
          image: updatedProduct.image,
          price: updatedProduct.price,
          product_id: updatedProduct.product_id || ensuredProductId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/[id]/edit",
      method: "POST",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "product_edit",
      extra: { stage: "unhandled" },
    });
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
