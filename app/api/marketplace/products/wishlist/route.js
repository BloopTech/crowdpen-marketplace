import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

const { MarketplaceWishlists } = db;

/**
 * GET handler to check if a product is in user's wishlist
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response with wishlist status
 */
export async function GET(request) {
  try {
    // Get current user from session
    const session = await getServerSession(authOptions);

    const userId = session?.user?.id || null;

    if (!session || !session.user) {
      return NextResponse.json(
        {
          status: "error",
          message: "Authentication required",
          count: 0,
        },
        { status: 401 }
      );
    }

    const wishlistCount = await MarketplaceWishlists.count({
      where: {
        user_id: userId,
      },
    });

    return NextResponse.json({
      status: "success",
      count: wishlistCount,
    });
  } catch (error) {
    console.error("Error checking wishlist status:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to check wishlist status",
        count: 0,
      },
      { status: 500 }
    );
  }
}