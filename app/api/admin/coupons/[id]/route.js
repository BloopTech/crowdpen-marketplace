import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";

const { MarketplaceCoupon, User } = db;

// Check if user is admin
async function isAdmin(session) {
  if (!session?.user?.id) return false;
  const user = await User.findByPk(session.user.id, { attributes: ['role'] });
  return user?.role === 'admin' || user?.role === 'senior_admin';
}

// GET /api/admin/coupons/[id] - Get single coupon
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const coupon = await MarketplaceCoupon.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
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
    console.error("Error fetching coupon:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to fetch coupon" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/coupons/[id] - Update coupon
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const coupon = await MarketplaceCoupon.findByPk(id);

    if (!coupon) {
      return NextResponse.json(
        { status: "error", message: "Coupon not found" },
        { status: 404 }
      );
    }

    // If changing code, check for duplicates
    if (body.code && body.code.toUpperCase() !== coupon.code) {
      const existing = await MarketplaceCoupon.findOne({
        where: { code: body.code.toUpperCase() },
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
    if (body.code !== undefined) updates.code = body.code.toUpperCase();
    if (body.description !== undefined) updates.description = body.description;
    if (body.discount_type !== undefined) updates.discount_type = body.discount_type;
    if (body.discount_value !== undefined) updates.discount_value = parseFloat(body.discount_value);
    if (body.min_order_amount !== undefined) updates.min_order_amount = parseFloat(body.min_order_amount);
    if (body.max_discount_amount !== undefined) updates.max_discount_amount = body.max_discount_amount ? parseFloat(body.max_discount_amount) : null;
    if (body.usage_limit !== undefined) updates.usage_limit = body.usage_limit ? parseInt(body.usage_limit) : null;
    if (body.start_date !== undefined) updates.start_date = body.start_date || null;
    if (body.end_date !== undefined) updates.end_date = body.end_date || null;
    if (body.is_active !== undefined) updates.is_active = !!body.is_active;
    if (body.applies_to !== undefined) updates.applies_to = body.applies_to;
    if (body.applies_to_ids !== undefined) updates.applies_to_ids = body.applies_to_ids;

    await coupon.update(updates);

    return NextResponse.json({
      status: "success",
      message: "Coupon updated successfully",
      coupon: coupon.toJSON(),
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to update coupon" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/coupons/[id] - Delete coupon
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const coupon = await MarketplaceCoupon.findByPk(id);

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
    console.error("Error deleting coupon:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to delete coupon" },
      { status: 500 }
    );
  }
}
