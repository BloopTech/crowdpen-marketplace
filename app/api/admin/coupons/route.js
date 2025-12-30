import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";

const { MarketplaceCoupon, User } = db;

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

// GET /api/admin/coupons - List all coupons with pagination and search
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-coupons:list:${userIdForRl}:${ip}`, limit: 120, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") || "20", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;
    const search = (searchParams.get("q") || "").slice(0, 200);
    const status = (searchParams.get("status") || "").slice(0, 20).toLowerCase(); // active, inactive, expired

    const offset = (page - 1) * limit;

    // Build where conditions
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (status === "active") {
      where.is_active = true;
      where[Op.or] = [
        { end_date: null },
        { end_date: { [Op.gte]: new Date() } },
      ];
    } else if (status === "inactive") {
      where.is_active = false;
    } else if (status === "expired") {
      where.end_date = { [Op.lt]: new Date() };
    }

    const { count, rows: coupons } = await MarketplaceCoupon.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return NextResponse.json({
      status: "success",
      coupons: coupons.map(c => c.toJSON()),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to fetch coupons" : (error?.message || "Failed to fetch coupons"),
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/coupons - Create a new coupon
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-coupons:create:${userIdForRl}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Validate required fields
    if (!body.code || !body.discount_type || body.discount_value === undefined) {
      return NextResponse.json(
        { status: "error", message: "Code, discount type, and discount value are required" },
        { status: 400 }
      );
    }

    const code = String(body.code || "").trim().toUpperCase();
    if (code.length < 3 || code.length > 50 || !/^[A-Z0-9_-]+$/.test(code)) {
      return NextResponse.json(
        { status: "error", message: "Invalid coupon code" },
        { status: 400 }
      );
    }

    const discountType = String(body.discount_type || "").toLowerCase();
    if (!['percentage', 'fixed'].includes(discountType)) {
      return NextResponse.json(
        { status: "error", message: "Invalid discount type" },
        { status: 400 }
      );
    }

    const descriptionText = body.description == null ? null : String(body.description);
    if (descriptionText && descriptionText.length > 255) {
      return NextResponse.json(
        { status: "error", message: "Description is too long" },
        { status: 413 }
      );
    }

    const appliesTo = body.applies_to == null ? 'all' : String(body.applies_to).toLowerCase();
    if (!['all', 'category', 'product'].includes(appliesTo)) {
      return NextResponse.json(
        { status: "error", message: "Invalid applies_to" },
        { status: 400 }
      );
    }

    const appliesToIdsRaw = body.applies_to_ids;
    const appliesToIds = Array.isArray(appliesToIdsRaw) ? appliesToIdsRaw : (appliesToIdsRaw == null ? [] : null);
    if (appliesToIds === null) {
      return NextResponse.json(
        { status: "error", message: "Invalid applies_to_ids" },
        { status: 400 }
      );
    }
    if (appliesToIds.length > 100) {
      return NextResponse.json(
        { status: "error", message: "Too many applies_to_ids" },
        { status: 413 }
      );
    }
    for (const id of appliesToIds) {
      if (!isUUID(id)) {
        return NextResponse.json(
          { status: "error", message: "Invalid applies_to_ids" },
          { status: 400 }
        );
      }
    }
    if (appliesTo !== 'all' && appliesToIds.length === 0) {
      return NextResponse.json(
        { status: "error", message: "applies_to_ids is required" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await MarketplaceCoupon.findOne({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { status: "error", message: "A coupon with this code already exists" },
        { status: 400 }
      );
    }

    // Create coupon
    const discountValue = Number.parseFloat(body.discount_value);
    const minOrderAmount = body.min_order_amount != null && body.min_order_amount !== ""
      ? Number.parseFloat(body.min_order_amount)
      : 0;
    const maxDiscountAmount = body.max_discount_amount != null && body.max_discount_amount !== ""
      ? Number.parseFloat(body.max_discount_amount)
      : null;
    const usageLimit = body.usage_limit != null && body.usage_limit !== ""
      ? Number.parseInt(body.usage_limit, 10)
      : null;

    if (!Number.isFinite(discountValue)) {
      return NextResponse.json(
        { status: "error", message: "Invalid discount value" },
        { status: 400 }
      );
    }
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json(
        { status: "error", message: "Invalid discount value" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      return NextResponse.json(
        { status: "error", message: "Invalid minimum order amount" },
        { status: 400 }
      );
    }
    if (maxDiscountAmount !== null && (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0)) {
      return NextResponse.json(
        { status: "error", message: "Invalid maximum discount amount" },
        { status: 400 }
      );
    }
    if (usageLimit !== null && (!Number.isFinite(usageLimit) || usageLimit < 1)) {
      return NextResponse.json(
        { status: "error", message: "Invalid usage limit" },
        { status: 400 }
      );
    }

    const parseDate = (v) => {
      if (v == null || v === "") return null;
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return null;
      return d;
    };
    const startDate = parseDate(body.start_date);
    const endDate = parseDate(body.end_date);
    if (body.start_date != null && body.start_date !== "" && !startDate) {
      return NextResponse.json(
        { status: "error", message: "Invalid start date" },
        { status: 400 }
      );
    }
    if (body.end_date != null && body.end_date !== "" && !endDate) {
      return NextResponse.json(
        { status: "error", message: "Invalid end date" },
        { status: 400 }
      );
    }
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      return NextResponse.json(
        { status: "error", message: "Invalid date range" },
        { status: 400 }
      );
    }

    const coupon = await MarketplaceCoupon.create({
      code,
      description: descriptionText || null,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount,
      max_discount_amount: maxDiscountAmount,
      usage_limit: usageLimit,
      start_date: startDate,
      end_date: endDate,
      is_active: body.is_active !== false,
      applies_to: appliesTo,
      applies_to_ids: appliesToIds,
      created_by: session.user.id,
    });

    return NextResponse.json({
      status: "success",
      message: "Coupon created successfully",
      coupon: coupon.toJSON(),
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to create coupon" : (error?.message || "Failed to create coupon"),
      },
      { status: 500 }
    );
  }
}
