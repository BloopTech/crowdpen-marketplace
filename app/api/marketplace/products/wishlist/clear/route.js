import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";

const { MarketplaceWishlists, User } = db;

export async function POST(request) {
  const { userId } = await request.json();
  try {
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
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
