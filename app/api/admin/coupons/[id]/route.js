import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

const { MarketplaceCoupon, User } = db;

export const runtime = "nodejs";

// Check if user is admin
async function isAdmin(session) {
  if (!session?.user?.id) return false;
  const user = await User.findByPk(session.user.id, { attributes: ['role', 'crowdpen_staff'] });
  return user?.crowdpen_staff === true || user?.role === 'admin' || user?.role === 'senior_admin';
}

function isUUID(v) {
  const s = String(v || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

// GET /api/admin/coupons/[id] - Get single coupon
export async function GET(request, { params }) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-coupons:get:${userIdForRl}:${ip}`, limit: 240, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { id } = await params;
    const couponId = String(id || "").trim().slice(0, 128);
    if (!couponId) {
      return NextResponse.json(
        { status: "error", message: "Missing id" },
        { status: 400 }
      );
    }

    const coupon = await MarketplaceCoupon.findByPk(couponId, {
      include: [
        {
          model: User,
          as: 'coupon_creator',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!coupon) {
      return NextResponse.json(
        { status: "error", message: "Coupon not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      coupon: coupon.toJSON(),
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_coupon_get",
      route: "/api/admin/coupons/[id]",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to fetch coupon" : (error?.message || "Failed to fetch coupon"),
      },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/coupons/[id] - Update coupon
export async function PATCH(request, { params }) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-coupons:update:${userIdForRl}:${ip}`, limit: 120, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { id } = await params;
    const couponId = String(id || "").trim().slice(0, 128);
    if (!couponId) {
      return NextResponse.json(
        { status: "error", message: "Missing id" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const coupon = await MarketplaceCoupon.findByPk(couponId);

    if (!coupon) {
      return NextResponse.json(
        { status: "error", message: "Coupon not found" },
        { status: 404 }
      );
    }

    // If changing code, check for duplicates
    const codeRaw = body.code;
    const code = codeRaw == null ? null : String(codeRaw).trim().toUpperCase();
    if (code && (code.length < 3 || code.length > 50 || !/^[A-Z0-9_-]+$/.test(code))) {
      return NextResponse.json(
        { status: "error", message: "Invalid coupon code" },
        { status: 400 }
      );
    }

    if (code && code !== coupon.code) {
      const existing = await MarketplaceCoupon.findOne({
        where: { code },
      });
      if (existing) {
        return NextResponse.json(
          { status: "error", message: "A coupon with this code already exists" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates = {};
    if (body.code !== undefined) updates.code = code;

    if (body.description !== undefined) {
      const descriptionText = body.description == null ? null : String(body.description);
      if (descriptionText && descriptionText.length > 255) {
        return NextResponse.json(
          { status: "error", message: "Description is too long" },
          { status: 413 }
        );
      }
      updates.description = descriptionText;
    }

    if (body.discount_type !== undefined) {
      const discountType = String(body.discount_type || "").toLowerCase();
      if (!['percentage', 'fixed'].includes(discountType)) {
        return NextResponse.json(
          { status: "error", message: "Invalid discount type" },
          { status: 400 }
        );
      }
      updates.discount_type = discountType;
    }

    if (body.discount_value !== undefined) {
      const v = Number.parseFloat(body.discount_value);
      if (!Number.isFinite(v)) {
        return NextResponse.json(
          { status: "error", message: "Invalid discount value" },
          { status: 400 }
        );
      }

      const effectiveType = String(updates.discount_type || coupon.discount_type || "").toLowerCase();
      if (effectiveType === 'percentage' && (v < 0 || v > 100)) {
        return NextResponse.json(
          { status: "error", message: "Invalid discount value" },
          { status: 400 }
        );
      }
      updates.discount_value = v;
    }

    if (body.min_order_amount !== undefined) {
      const v = Number.parseFloat(body.min_order_amount);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json(
          { status: "error", message: "Invalid minimum order amount" },
          { status: 400 }
        );
      }
      updates.min_order_amount = v;
    }

    if (body.max_discount_amount !== undefined) {
      if (body.max_discount_amount == null || body.max_discount_amount === "") {
        updates.max_discount_amount = null;
      } else {
        const v = Number.parseFloat(body.max_discount_amount);
        if (!Number.isFinite(v) || v < 0) {
          return NextResponse.json(
            { status: "error", message: "Invalid maximum discount amount" },
            { status: 400 }
          );
        }
        updates.max_discount_amount = v;
      }
    }

    if (body.usage_limit !== undefined) {
      if (body.usage_limit == null || body.usage_limit === "") {
        updates.usage_limit = null;
      } else {
        const v = Number.parseInt(body.usage_limit, 10);
        if (!Number.isFinite(v) || v < 1) {
          return NextResponse.json(
            { status: "error", message: "Invalid usage limit" },
            { status: 400 }
          );
        }
        updates.usage_limit = v;
      }
    }
    const parseDate = (v) => {
      if (v == null || v === "") return null;
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return null;
      return d;
    };
    const startDate = body.start_date !== undefined ? parseDate(body.start_date) : undefined;
    const endDate = body.end_date !== undefined ? parseDate(body.end_date) : undefined;
    if (body.start_date !== undefined && body.start_date !== null && body.start_date !== "" && !startDate) {
      return NextResponse.json(
        { status: "error", message: "Invalid start date" },
        { status: 400 }
      );
    }
    if (body.end_date !== undefined && body.end_date !== null && body.end_date !== "" && !endDate) {
      return NextResponse.json(
        { status: "error", message: "Invalid end date" },
        { status: 400 }
      );
    }
    const effectiveStart = startDate === undefined ? coupon.start_date : startDate;
    const effectiveEnd = endDate === undefined ? coupon.end_date : endDate;
    if (effectiveStart && effectiveEnd) {
      const s = new Date(effectiveStart);
      const e = new Date(effectiveEnd);
      if (Number.isFinite(s.getTime()) && Number.isFinite(e.getTime()) && e.getTime() < s.getTime()) {
        return NextResponse.json(
          { status: "error", message: "Invalid date range" },
          { status: 400 }
        );
      }
    }
    if (body.start_date !== undefined) updates.start_date = startDate;
    if (body.end_date !== undefined) updates.end_date = endDate;
    if (body.is_active !== undefined) updates.is_active = !!body.is_active;

    if (body.applies_to !== undefined) {
      const appliesTo = body.applies_to == null ? 'all' : String(body.applies_to).toLowerCase();
      if (!['all', 'category', 'product'].includes(appliesTo)) {
        return NextResponse.json(
          { status: "error", message: "Invalid applies_to" },
          { status: 400 }
        );
      }
      updates.applies_to = appliesTo;
    }

    if (body.applies_to_ids !== undefined) {
      const raw = body.applies_to_ids;
      const ids = Array.isArray(raw) ? raw : (raw == null ? [] : null);
      if (ids === null) {
        return NextResponse.json(
          { status: "error", message: "Invalid applies_to_ids" },
          { status: 400 }
        );
      }
      if (ids.length > 100) {
        return NextResponse.json(
          { status: "error", message: "Too many applies_to_ids" },
          { status: 413 }
        );
      }
      for (const id of ids) {
        if (!isUUID(id)) {
          return NextResponse.json(
            { status: "error", message: "Invalid applies_to_ids" },
            { status: 400 }
          );
        }
      }
      updates.applies_to_ids = ids;
    }

    const effAppliesTo = updates.applies_to !== undefined ? updates.applies_to : coupon.applies_to;
    const effIds = updates.applies_to_ids !== undefined ? updates.applies_to_ids : coupon.applies_to_ids;
    if (effAppliesTo !== 'all' && Array.isArray(effIds) && effIds.length === 0) {
      return NextResponse.json(
        { status: "error", message: "applies_to_ids is required" },
        { status: 400 }
      );
    }

    await coupon.update(updates);

    return NextResponse.json({
      status: "success",
      message: "Coupon updated successfully",
      coupon: coupon.toJSON(),
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_coupon_update",
      route: "/api/admin/coupons/[id]",
      method: "PATCH",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to update coupon" : (error?.message || "Failed to update coupon"),
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/coupons/[id] - Delete coupon
export async function DELETE(request, { params }) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-coupons:delete:${userIdForRl}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { id } = await params;
    const couponId = String(id || "").trim().slice(0, 128);
    if (!couponId) {
      return NextResponse.json(
        { status: "error", message: "Missing id" },
        { status: 400 }
      );
    }

    const coupon = await MarketplaceCoupon.findByPk(couponId);

    if (!coupon) {
      return NextResponse.json(
        { status: "error", message: "Coupon not found" },
        { status: 404 }
      );
    }

    await coupon.destroy();

    return NextResponse.json({
      status: "success",
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_coupon_delete",
      route: "/api/admin/coupons/[id]",
      method: "DELETE",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to delete coupon" : (error?.message || "Failed to delete coupon"),
      },
      { status: 500 }
    );
  }
}
