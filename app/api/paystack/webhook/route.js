import { NextResponse } from "next/server";
import {
  getRequestIdFromHeaders,
  reportError,
} from "../../../lib/observability/reportError";

export const runtime = "nodejs";

function bufferToString(buf) {
  try {
    if (typeof buf === "string") return buf;
    return Buffer.from(buf).toString("utf8");
  } catch {
    return "";
  }
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractMetadata(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload?.data?.metadata || payload?.metadata || null;
}

function isMarketplaceWebhook(payload) {
  const meta = extractMetadata(payload) || {};
  const orderId = (meta?.orderId || meta?.order_id || "").toString().trim();
  if (orderId) return true;

  const appMarker = (meta?.app || meta?.crowdpenApp || meta?.source || "")
    .toString()
    .trim()
    .toLowerCase();
  if (["marketplace", "crowdpen_marketplace"].includes(appMarker)) return true;

  return false;
}

function getMarketplaceWebhookUrl(request) {
  const envUrl = (process.env.MARKETPLACE_PAYSTACK_WEBHOOK_URL || "")
    .toString()
    .trim();
  if (envUrl) return envUrl;

  try {
    const origin = new URL(request.url).origin;
    return `${origin}/api/marketplace/paystack/webhook`;
  } catch {
    return "https://marketplace.crowdpen.co/api/marketplace/paystack/webhook";
  }
}

export async function POST(request) {
  const requestId = getRequestIdFromHeaders(request.headers);

  let rawBody = null;
  try {
    rawBody = await request.arrayBuffer();
  } catch (e) {
    await reportError(e, {
      route: "/api/paystack/webhook",
      method: "POST",
      status: 400,
      requestId,
      tag: "paystack_webhook_router_read_body_failed",
    });
    return NextResponse.json({ status: "success" });
  }

  const rawText = bufferToString(rawBody);
  const payload = safeJsonParse(rawText) || {};

  const shouldForward = isMarketplaceWebhook(payload);
  if (!shouldForward) {
    return NextResponse.json({ status: "success" });
  }

  const signature = request.headers.get("x-paystack-signature");
  const contentType = request.headers.get("content-type") || "application/json";

  const url = getMarketplaceWebhookUrl(request);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "content-type": contentType,
          ...(signature ? { "x-paystack-signature": signature } : {}),
        },
        body: Buffer.from(rawBody),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    await reportError(e, {
      route: "/api/paystack/webhook",
      method: "POST",
      status: 200,
      requestId,
      tag: "paystack_webhook_router_forward_failed",
      extra: {
        forwardUrl: url,
      },
    });
  }

  return NextResponse.json({ status: "success" });
}
