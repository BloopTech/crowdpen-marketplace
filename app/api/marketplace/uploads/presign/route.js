import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import {
  getClientIpFromHeaders,
  rateLimit,
  rateLimitResponseHeaders,
} from "../../../../lib/security/rateLimit";
import {
  getRequestIdFromHeaders,
  reportError,
} from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

const REQUIRED_R2_ENV = [
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_PUBLIC_URL",
];

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const sanitizeObjectName = (name) => {
  return String(name || "upload")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);
};

export async function POST(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session;
  try {
    // if (REQUIRED_R2_ENV.some((k) => !process.env[k])) {
    //   return NextResponse.json(
    //     { status: "error", message: "Uploads unavailable. Please retry shortly." },
    //     { status: 503 }
    //   );
    // }

    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userId = String(session.user.id);
    const rl = rateLimit({
      key: `uploads-presign:${userId}:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const kind = (body?.kind || "").toString();
    const filename = sanitizeObjectName(body?.filename);
    const contentType = (body?.contentType || "").toString();
    const size = Number(body?.size || 0) || 0;

    if (!kind || (kind !== "image" && kind !== "productFile")) {
      return NextResponse.json(
        { status: "error", message: "Invalid upload kind" },
        { status: 400 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { status: "error", message: "Invalid filename" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { status: "error", message: "Invalid file size" },
        { status: 400 }
      );
    }

    if (kind === "image") {
      const max = 3 * 1024 * 1024;
      if (size > max) {
        return NextResponse.json(
          { status: "error", message: "Image must be 3MB or less" },
          { status: 413 }
        );
      }
      if (!contentType || !contentType.startsWith("image/")) {
        return NextResponse.json(
          { status: "error", message: "Invalid image type" },
          { status: 400 }
        );
      }
    }

    if (kind === "productFile") {
      const max = 25 * 1024 * 1024;
      if (size > max) {
        return NextResponse.json(
          { status: "error", message: "Product file must be 25MB or less" },
          { status: 413 }
        );
      }
    }

    const prefix =
      kind === "image"
        ? `marketplace/uploads/${userId}/images`
        : `marketplace/uploads/${userId}/files`;

    const suffix = crypto.randomBytes(16).toString("hex");
    const key = `${prefix}/${suffix}_${filename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;

    return NextResponse.json(
      {
        status: "success",
        message: "Upload URL created",
        data: {
          method: "PUT",
          uploadUrl,
          publicUrl,
          key,
          headers: {
            "Content-Type": contentType || "application/octet-stream",
          },
        },
      },
      { status: 200, headers: rateLimitResponseHeaders(rl) }
    );
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/uploads/presign",
      method: "POST",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "uploads_presign",
      extra: { stage: "unhandled" },
    });
    return NextResponse.json(
      { status: "error", message: "Unable to prepare upload. Please try again." },
      { status: 500 }
    );
  }
}
