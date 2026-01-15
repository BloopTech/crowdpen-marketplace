import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
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

async function checkBucketReachable() {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  // Some R2-compatible setups reject HeadBucket; fall back to a tiny list
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    try {
      await s3Client.send(
        new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })
      );
      return true;
    } catch {
      return false;
    }
  }
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session;
  try {
    if (REQUIRED_R2_ENV.some((k) => !process.env[k])) {
      return NextResponse.json(
        { status: "error", message: "Uploads unavailable. Please retry shortly." },
        { status: 503 }
      );
    }

    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({
      key: `upload-capabilities:${session.user.id}:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const reachable = await checkBucketReachable();
    if (!reachable) {
      return NextResponse.json(
        { status: "error", message: "Uploads unavailable. Please retry shortly." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Uploads available",
        data: { bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME },
      },
      { status: 200 }
    );
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/upload-capabilities",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "upload_capabilities",
      extra: { stage: "unhandled" },
    });
    return NextResponse.json(
      { status: "error", message: "Uploads unavailable. Please try again." },
      { status: 500 }
    );
  }
}
