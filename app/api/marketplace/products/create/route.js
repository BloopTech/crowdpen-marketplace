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

    // Extract product data directly from form fields
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
      featured:
        formData.get("featured") === "true" ||
        formData.get("featured") === "on",
    };

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

    // Upload images to Cloudflare R2 if there are files
    let featuredImageUrl = null;
    console.log("Before image upload check:", { hasFiles: imageFiles && imageFiles.length > 0, hasValidSize: imageFiles && imageFiles.length > 0 && imageFiles[0].size > 0 });

    if (imageFiles && imageFiles.length > 0 && imageFiles[0].size > 0) {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
      const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

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

    // Create new product in database
    const createdProduct = await db.MarketplaceProduct.create({
      ...productData,
      user_id: userId,
      images: imageUrls,
      image: imageUrls[0] || null,
      fileType: productData.fileType,
      fileSize: productData.fileSize || "",
      license: productData.license || "Standard",
      deliveryTime: productData.deliveryTime || "Instant",
      featured: productData.featured || false,
    });

    return NextResponse.json(
      {
        status: "success",
        message: "Product created successfully",
        data: {
          id: createdProduct.id,
          title: createdProduct.title,
          image: createdProduct.image,
          images: createdProduct.images,
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
