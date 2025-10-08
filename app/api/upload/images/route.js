import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { authOptions } from "../../auth/[...nextauth]/route";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const sanitizeFilename = (filename) => {
  return (
    filename
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/\.[^.]+$/, "") + ".webp"
  );
};

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

export async function POST(request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get form data with files
    const formData = await request.formData();
    // Allow callers to specify a target folder (e.g., 'products' or 'kyc')
    const folder = (formData.get("folder") || "products").toString();
    const files = [];

    // Collect all files from the form data
    for (const [key, value] of formData.entries()) {
      if (value instanceof Blob) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { message: "No files provided" },
        { status: 400 }
      );
    }

    // Process and upload each file
    const uploadedUrls = [];
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

    for (const file of files) {
      try {
        const imagecode = randomImageName();

        // Files from formData() are instances of File (subclass of Blob) and have a `name` property
        // Fallback to a default if not provided (e.g., when appending a plain Blob without a name)
        const originalname = sanitizeFilename(
          typeof file.name === "string" && file.name.trim() !== ""
            ? file.name
            : "upload"
        );

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

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
        const prefix = folder === "kyc" ? "kyc" : "product";
        const fileName = `${prefix}-${imagecode}.${originalname}`;
        const key = `${folder}/${fileName}`;

        // Upload to Cloudflare R2
        const s3Params = {
          Bucket: bucketName,
          Key: key,
          Body: compressedBuffer,
          ContentType: "image/webp",
        };

        const command = new PutObjectCommand(s3Params);
        await s3Client.send(command);

        // Create public URL for the uploaded image
        const imageUrl = `${publicUrlBase}/${key}`;
        uploadedUrls.push(imageUrl);
      } catch (error) {
        console.error("Error processing file:", error);
        // Continue with other files if one fails
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { message: "Failed to upload images" },
        { status: 500 }
      );
    }

    // Return the URLs of successfully uploaded images
    return NextResponse.json({
      message: "Images uploaded successfully",
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { message: "Error uploading images: " + error.message },
      { status: 500 }
    );
  }
}
