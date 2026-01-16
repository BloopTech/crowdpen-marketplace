import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

function keyFromPublicUrl(url) {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (!base || !url) return null;
  const normalizedBase = String(base).replace(/\/+$/, "");
  const normalizedUrl = String(url);
  if (!normalizedUrl.startsWith(`${normalizedBase}/`)) return null;
  return normalizedUrl.slice(normalizedBase.length + 1);
}

function isAllowedUserKey(key, userId) {
  if (!key || !userId) return false;
  const prefix = `marketplace/uploads/${userId}/`;
  return String(key).startsWith(prefix);
}

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
      key: `uploads-delete:${userId}:${ip}`,
      limit: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));

    const rawKeys = Array.isArray(body?.keys)
      ? body.keys
      : body?.key
        ? [body.key]
        : [];

    const rawUrls = Array.isArray(body?.publicUrls)
      ? body.publicUrls
      : body?.publicUrl
        ? [body.publicUrl]
        : [];

    const derivedKeys = rawUrls
      .map((u) => keyFromPublicUrl(u))
      .filter(Boolean);

    const keys = [...rawKeys, ...derivedKeys]
      .map((k) => (k == null ? "" : String(k).trim()))
      .filter(Boolean);

    if (keys.length === 0) {
      return NextResponse.json(
        { status: "error", message: "No keys provided" },
        { status: 400 }
      );
    }

    const unique = Array.from(new Set(keys));

    const denied = unique.filter((k) => !isAllowedUserKey(k, userId));
    if (denied.length > 0) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    await Promise.all(
      unique.map((Key) =>
        s3Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key,
          })
        )
      )
    );

    return NextResponse.json(
      {
        status: "success",
        message: "Deleted",
        data: { deleted: unique.length },
      },
      { status: 200, headers: rateLimitResponseHeaders(rl) }
    );
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/uploads/delete",
      method: "POST",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "uploads_delete",
      extra: { stage: "unhandled" },
    });
    return NextResponse.json(
      { status: "error", message: "Unable to delete upload. Please try again." },
      { status: 500 }
    );
  }
}
