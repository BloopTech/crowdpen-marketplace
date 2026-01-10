import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";
import { getMarketplaceFeePercents, normalizeFeePctInput } from "../../../lib/marketplaceFees";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-fees:get:${userIdForRl}:${ip}`, limit: 120, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const fees = await getMarketplaceFeePercents({ db });

    return NextResponse.json({
      status: "success",
      data: {
        crowdpenPct: fees.crowdpenPct,
        startbuttonPct: fees.startbuttonPct,
      },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_fees_get",
      route: "/api/admin/fees",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-fees:put:${userIdForRl}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.crowdpenPct === "undefined" || typeof body?.startbuttonPct === "undefined") {
      return NextResponse.json(
        { status: "error", message: "crowdpenPct and startbuttonPct are required" },
        { status: 400 }
      );
    }

    const crowdpenPct = normalizeFeePctInput(body?.crowdpenPct);
    const startbuttonPct = normalizeFeePctInput(body?.startbuttonPct);

    const row = await db.MarketplaceFeeSettings.findOne({
      where: { is_active: true },
      order: [["createdAt", "DESC"]],
    });

    if (row) {
      await row.update({
        crowdpen_fee_pct: crowdpenPct,
        startbutton_fee_pct: startbuttonPct,
      });
    } else {
      await db.MarketplaceFeeSettings.create({
        crowdpen_fee_pct: crowdpenPct,
        startbutton_fee_pct: startbuttonPct,
        is_active: true,
      });
    }

    return NextResponse.json({
      status: "success",
      data: { crowdpenPct, startbuttonPct },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_fees_put",
      route: "/api/admin/fees",
      method: "PUT",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
