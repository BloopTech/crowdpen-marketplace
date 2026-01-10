import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { authOptions } from "../../auth/[...nextauth]/route";
import crypto from "crypto";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";
import { assertRequiredEnvInProduction } from "../../../lib/env";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

assertRequiredEnvInProduction([
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_PUBLIC_URL",
]);

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
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userId = session?.user?.id ? String(session.user.id) : "anon";
    const rl = rateLimit({ key: `upload-images:${userId}:${ip}`, limit: 30, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    // Get form data with files
    const formData = await request.formData();
    // Allow callers to specify a target folder (e.g., 'products' or 'kyc')
    const folderRaw = (formData.get("folder") || "products").toString().trim().toLowerCase();
    const folder = folderRaw === "kyc" ? "kyc" : "products";
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

    const MAX_FILES = 10;
    const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;
    const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

    if (files.length > MAX_FILES) {
      return NextResponse.json({ message: "Too many files" }, { status: 413 });
    }

    const totalBytes = files.reduce((sum, f) => sum + (typeof f?.size === "number" ? f.size : 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ message: "Files too large" }, { status: 413 });
    }

    // Process and upload each file
    const uploadedUrls = [];
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

    for (const file of files) {
      try {
        if (typeof file?.size === "number" && file.size > MAX_BYTES_PER_FILE) {
          continue;
        }

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
        await reportError(error, {
          route: "/api/upload/images",
          method: "POST",
          status: 500,
          requestId,
          userId: session?.user?.id || null,
          tag: "upload_images",
          extra: { stage: "process_file" },
        });
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
    await reportError(error, {
      route: "/api/upload/images",
      method: "POST",
      status: 500,
      requestId,
      tag: "upload_images",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        message: isProd
          ? "Error uploading images"
          : "Error uploading images: " + (error?.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}
