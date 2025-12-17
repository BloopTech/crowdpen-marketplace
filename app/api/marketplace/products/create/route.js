import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";

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

const PRODUCT_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateProductIdCandidate(length = 10) {
  const bytes = crypto.randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += PRODUCT_ID_CHARS[bytes[i] % PRODUCT_ID_CHARS.length];
  }
  return id;
}

async function generateUniqueProductId(preferredLength = 10, fallbackLength = 8, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const useLength = attempt < Math.floor(maxAttempts / 2) ? preferredLength : fallbackLength;
    const candidate = generateProductIdCandidate(useLength);
    const exists = await db.MarketplaceProduct.findOne({
      where: { product_id: candidate },
      attributes: ["product_id", "id"],
    });
    if (!exists) return candidate;
  }
  throw new Error("Unable to generate unique product_id");
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export async function POST(request) {
  try {
    // Process form data
    const formData = await request.formData();

    // Get user ID from form data
    const userId = formData.get("user_id");
    if (!userId) {
      return NextResponse.json({ 
        status: "error",
        message: "User ID is required" 
      }, { status: 400 });
    }

    const merchantBank = db?.MarketplaceMerchantBank
      ? await db.MarketplaceMerchantBank.findOne({
          where: { user_id: userId },
          attributes: ["currency"],
        })
      : null;
    const resolvedCurrency =
      (typeof merchantBank?.currency === "string" && merchantBank.currency.trim())
        ? merchantBank.currency.trim().toUpperCase()
        : "USD";

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
    
    // Check if we have actual file objects or just strings
    const hasFileObjects = imageFiles.length > 0 && imageFiles[0] instanceof File;
    
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
          console.error("Error processing image URLs:", error);
        }
      }
    }

    // Upload product file to Cloudflare R2 if provided
    let productFileUrl = null;
    let calculatedFileSize = "";
    
    if (productFile && productFile.size > 0) {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
      const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

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
        
        // Generate unique filename
        const fileCode = randomImageName();
        const sanitizedName = sanitizeProductFilename(productFile.name);
        const fileName = `marketplace/files/${fileCode}_${sanitizedName}`;
        
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
        console.error("Error uploading product file:", error);
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
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
      const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

      const maxTotalImageSize = 3 * 1024 * 1024; // 3MB total across all images
      const totalImageSize = imageFiles.reduce((sum, file) => {
        if (file && typeof file.size === "number") {
          return sum + file.size;
        }
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
            console.error('Error converting file to buffer:', bufferError);
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
          console.error("Error processing file:", error);
          // Continue with other files if one fails
        }
      }

      // Set the first image as featured if requested
      if (imageUrls.length > 0) {
        featuredImageUrl = imageUrls[0];
      }

      // If no images were successfully uploaded, return error
      if (imageUrls.length === 0) {
        return NextResponse.json(
          { message: "Failed to upload images", status: "error" },
          { status: 500 }
        );
      }
    }

    let createdProduct;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const productId = await generateUniqueProductId();
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
        });
        lastError = undefined;
        break;
      } catch (e) {
        if (e?.name === 'SequelizeUniqueConstraintError' || e?.parent?.code === '23505') {
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    if (!createdProduct) {
      throw lastError || new Error("Failed to create product with unique product_id");
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Product created successfully",
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
    console.error("Error creating product:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to create product",
      },
      { status: 500 }
    );
  }
}
