import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

const { MarketplaceWishlists, MarketplaceProduct } = db;

export const runtime = "nodejs";

/**
 * GET handler to check if a product is in user's wishlist
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response with wishlist status
 */
export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    // Get current user from session
    session = await getServerSession(authOptions);
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

    const userId = session.user.id;

    // Count only wishlist items with published products
    const wishlistCount = await MarketplaceWishlists.count({
      where: {
        user_id: userId,
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
      count: wishlistCount,
    });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/wishlist",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "wishlist_count",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to check wishlist status"
          : (error?.message || "Failed to check wishlist status"),
        count: 0,
      },
      { status: 500 }
    );
  }
}