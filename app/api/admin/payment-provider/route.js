import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
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

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

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
    const rl = rateLimit({
      key: `admin-payment-provider:get:${userIdForRl}:${ip}`,
      limit: 120,
      windowMs: 60_000,
    });
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
      tag: "admin_payment_provider_get",
      route: "/api/admin/payment-provider",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : error?.message || "Failed" },
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
    const rl = rateLimit({
      key: `admin-payment-provider:put:${userIdForRl}:${ip}`,
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
    const nextProvider = normalizeProvider(body?.activeProvider);
    if (!nextProvider) {
      return NextResponse.json(
        { status: "error", message: "activeProvider must be 'startbutton' or 'paystack'" },
        { status: 400 }
      );
    }

    if (!db?.MarketplacePaymentProviderSettings) {
      return NextResponse.json(
        { status: "error", message: "Settings model not configured" },
        { status: 500 }
      );
    }

    const t = await db.sequelize.transaction();
    try {
      const activeRow = await db.MarketplacePaymentProviderSettings.findOne({
        where: { is_active: true },
        order: [["createdAt", "DESC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const currentProvider = normalizeProvider(activeRow?.active_provider);

      if (activeRow && currentProvider === nextProvider) {
        await t.commit();
        return NextResponse.json({
          status: "success",
          data: { activeProvider: nextProvider },
        });
      }

      if (activeRow) {
        await activeRow.update({ is_active: false }, { transaction: t });
      }

      await db.MarketplacePaymentProviderSettings.create(
        { active_provider: nextProvider, is_active: true },
        { transaction: t }
      );

      await t.commit();

      return NextResponse.json({
        status: "success",
        data: { activeProvider: nextProvider },
      });
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } catch (error) {
    await reportError(error, {
      tag: "admin_payment_provider_put",
      route: "/api/admin/payment-provider",
      method: "PUT",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : error?.message || "Failed" },
      { status: 500 }
    );
  }
}
