import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

const { MarketplaceCart, MarketplaceCartItems, MarketplaceProduct } = db;

/**
 * GET handler to check if a product is in user's cart
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response with cart status
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

    const carts = await MarketplaceCart.findAll({
      where: {
        user_id: userId,
      },
    });

    if (!carts?.length) {
      return NextResponse.json(
        {
          status: "error",
          message: "No cart found",
          count: 0,
        },
        { status: 401 }
      );
    }

    // Count only items with published products
    const cartCount = await MarketplaceCartItems.count({
      where: {
        marketplace_cart_id: carts[0].id,
      },
      include: [
        {
          model: MarketplaceProduct,
          where: { product_status: 'published' },
          attributes: [],
        },
      ],
    });

    return NextResponse.json({
      status: "success",
      count: cartCount,
    });
  } catch (error) {
    console.error("Error checking cart status:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to check cart status",
        count: 0,
      },
      { status: 500 }
    );
  }
}
