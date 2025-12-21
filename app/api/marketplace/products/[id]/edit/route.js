import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";

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

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export async function GET(request, { params }) {
  const getParams = await params;
  const { id } = getParams;
  try {
    // Add your GET logic here
  } catch (error) {
    // Handle GET error
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Process form data
    const formData = await request.formData();

    // Get product ID from form data
    const productId = formData.get("productId");
    if (!productId || productId !== id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid product ID",
        },
        { status: 400 }
      );
    }

    const user_id = formData.get("user_id");

    // Verify product ownership
    const existingProduct = await MarketplaceProduct.findOne({
      where: {
        id: productId,
        user_id,
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

    // Get existing images
    const existingImagesJson = formData.get("existingImages");
    if (existingImagesJson) {
      try {
        const existingImages = JSON.parse(existingImagesJson);
        if (Array.isArray(existingImages)) {
          finalImages = [...existingImages];
        }
      } catch (e) {
        console.warn("Failed to parse existing images:", e);
      }
    }

    // Get new image files from form data
    const newImageFiles = formData.getAll("images");

    // Process new images if any
    if (newImageFiles && newImageFiles.length > 0) {
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
            console.error("Error processing image:", error);
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

    // Handle product file - both existing and new
    let finalProductFile = null;
    let finalFileSize = productData.fileSize;
    let finalFileType = productData.fileType;

    // Check for existing product file
    const existingProductFile = formData.get("existingProductFile");
    if (existingProductFile) {
      finalProductFile = existingProductFile;
    }

    // Check for new product file (overrides existing)
    const newProductFile = formData.get("productFile");
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
            { status: 400 }
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
        console.error("Error processing product file:", error);
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
    });

    return NextResponse.json(
      {
        status: "success",
        message: "Product updated successfully!",
        data: {
          id: updatedProduct.id,
          title: updatedProduct.title,
          image: updatedProduct.image,
          price: updatedProduct.price,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
