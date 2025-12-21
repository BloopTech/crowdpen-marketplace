import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";

const { MarketplaceCoupon, User } = db;

// Check if user is admin
async function isAdmin(session) {
  if (!session?.user?.id) return false;
  const user = await User.findByPk(session.user.id, { attributes: ['role'] });
  return user?.role === 'admin' || user?.role === 'senior_admin';
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("q") || "";
    const status = searchParams.get("status") || ""; // active, inactive, expired

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
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to fetch coupons" },
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

    const body = await request.json();

    // Validate required fields
    if (!body.code || !body.discount_type || body.discount_value === undefined) {
      return NextResponse.json(
        { status: "error", message: "Code, discount type, and discount value are required" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await MarketplaceCoupon.findOne({
      where: { code: body.code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { status: "error", message: "A coupon with this code already exists" },
        { status: 400 }
      );
    }

    // Create coupon
    const coupon = await MarketplaceCoupon.create({
      code: body.code.toUpperCase(),
      description: body.description || null,
      discount_type: body.discount_type,
      discount_value: parseFloat(body.discount_value),
      min_order_amount: body.min_order_amount ? parseFloat(body.min_order_amount) : 0,
      max_discount_amount: body.max_discount_amount ? parseFloat(body.max_discount_amount) : null,
      usage_limit: body.usage_limit ? parseInt(body.usage_limit) : null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      is_active: body.is_active !== false,
      applies_to: body.applies_to || 'all',
      applies_to_ids: body.applies_to_ids || [],
      created_by: session.user.id,
    });

    return NextResponse.json({
      status: "success",
      message: "Coupon created successfully",
      coupon: coupon.toJSON(),
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to create coupon" },
      { status: 500 }
    );
  }
}
