import { NextResponse } from "next/server";
import { db } from "../../../models/index";
import {
  getClientIpFromHeaders,
  rateLimit,
  rateLimitResponseHeaders,
} from "../../../lib/security/rateLimit";
import {
  getRequestIdFromHeaders,
  reportError,
} from "../../../lib/observability/reportError";

export const runtime = "nodejs";

function normalizeProvider(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "startbutton" || v === "paystack") return v;
  return null;
}

async function getActiveProvider() {
  if (!db?.MarketplacePaymentProviderSettings) return "startbutton";

  try {
    const row = await db.MarketplacePaymentProviderSettings.findOne({
      where: { is_active: true },
      order: [["createdAt", "DESC"]],
      attributes: ["active_provider"],
    });

    const p = normalizeProvider(row?.active_provider);
    return p || "startbutton";
  } catch (e) {
    const code = e?.original?.code || e?.code;
    if (code === "42P01") return "startbutton";
    return "startbutton";
  }
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  try {
    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({ key: `marketplace-payment-provider:get:${ip}`, limit: 300, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const activeProvider = await getActiveProvider();

    return NextResponse.json({
      status: "success",
      data: { activeProvider },
    });
  } catch (error) {
    await reportError(error, {
      tag: "marketplace_payment_provider_get",
      route: "/api/marketplace/payment-provider",
      method: "GET",
      status: 500,
      requestId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : error?.message || "Failed" },
      { status: 500 }
    );
  }
}
