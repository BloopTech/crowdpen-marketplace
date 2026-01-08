import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { db } from "../../../../../models/index";
import { z } from "zod";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../lib/security/rateLimit";

const { MarketplaceCart, MarketplaceCartItems, User } = db;

// Validation schema
const clearCartSchema = z.object({
  penName: z.string().min(1).max(80),
});

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Validate request body
    const validationResult = clearCartSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid request data", 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }
    
    const { penName } = validationResult.data;
    
    // Get session to verify user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `cart-clear:${userIdForRl}:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    // Verify the user is clearing their own cart (do not trust session.pen_name)
    const sessionUserId = String(session.user.id);
    const sessionUser = await User.findOne({
      where: { id: sessionUserId },
      attributes: ["id", "pen_name"],
    });

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    if (String(sessionUser.pen_name || "") !== String(penName)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    
    // Find user's cart
    const cart = await MarketplaceCart.findOne({
      where: {
        user_id: sessionUserId,
        active: true
      }
    });
    
    if (!cart) {
      return NextResponse.json({
        success: true,
        message: "Cart is already empty",
        data: { clearedCount: 0 }
      });
    }
    
    // Remove all cart items
    const deletedCount = await MarketplaceCartItems.destroy({
      where: { marketplace_cart_id: cart.id }
    });
    
    // Reset cart totals
    await cart.update({
      subtotal: 0.00,
      discount: 0.00,
      total: 0.00,
      coupon_id: null,
      coupon_code: null,
      coupon_applied_at: null
    });
    
    return NextResponse.json({
      success: true,
      message: `Removed ${deletedCount} items from cart`,
      data: {
        clearedCount: deletedCount
      }
    });
    
  } catch (error) {
    console.error("Clear Cart API Error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: "Internal server error", ...(isProd ? {} : { details: error?.message }) },
      { status: 500 }
    );
  }
}
