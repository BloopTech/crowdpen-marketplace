import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../lib/security/rateLimit";

const { MarketplaceWishlists, User } = db;

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `wishlist-clear:${userIdForRl}:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const bodyUserId = body?.userId;
    if (
      bodyUserId != null &&
      String(bodyUserId).slice(0, 128) !== String(session.user.id)
    ) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Find user
    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id"],
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count items before deletion
    const itemCount = await MarketplaceWishlists.count({
      where: { user_id: user.id },
    });

    if (itemCount === 0) {
      return NextResponse.json({
        success: true,
        message: "Wishlist is already empty",
        data: { clearedCount: 0 },
      });
    }

    // Delete all wishlist items for the user
    await MarketplaceWishlists.destroy({
      where: { user_id: user.id },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully cleared ${itemCount} items from wishlist`,
      data: {
        clearedCount: itemCount,
      },
    });
  } catch (error) {
    console.error("Clear wishlist API error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: "Internal server error", ...(isProd ? {} : { details: error?.message }) },
      { status: 500 }
    );
  }
}
