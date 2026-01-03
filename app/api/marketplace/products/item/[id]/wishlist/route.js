import { NextResponse } from "next/server";
import { db } from "../../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { validate as isUUID } from "uuid";
import { Op } from "sequelize";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../../lib/security/rateLimit";

const {
  MarketplaceWishlists,
  MarketplaceProduct,
  User,
  MarketplaceKycVerification
} = db;

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

/**
 * POST handler to toggle a product in user's wishlist
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response indicating success or error
 */
export async function POST(request, { params }) {
  const getParams = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Authentication required",
        },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `wishlist-toggle:${userIdForRl}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const bodyUserId = body?.user_id;
    const sessionUserId = session.user.id;
    if (bodyUserId != null && String(bodyUserId).slice(0, 128) !== String(sessionUserId)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid user authentication",
        },
        { status: 403 }
      );
    }

    const user_id = sessionUserId;

    // Require a valid session and ensure it matches the provided user_id
    // Verify the user_id matches the session user
    if (!user_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid user authentication",
        },
        { status: 403 }
      );
    }

    const productIdRaw = getParams?.id == null ? "" : String(getParams.id).trim();
    if (!productIdRaw || productIdRaw.length > 128) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product ID is required",
        },
        { status: 400 }
      );
    }

    const idParam = String(productIdRaw);
    const orConditions = [{ product_id: idParam }];
    if (isUUID(idParam)) {
      orConditions.unshift({ id: idParam });
    }

    // Check if product exists and load owner's KYC status

    const product = await MarketplaceProduct.findOne({
      where: {
        [Op.or]: orConditions,
      },
      attributes: ['id', 'user_id', 'product_status'],
      include: [
        {
          model: User,
          attributes: ["id", "role", "crowdpen_staff"],
          include: [
            {
              model: MarketplaceKycVerification,
              attributes: ["status"],
              required: false,
            },
          ],
        },
      ],
    });
    if (!product) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product not found",
        },
        { status: 404 }
      );
    }

    // Block adding non-published products (unless viewer is owner)
    const isOwnerForStatus = product.user_id === user_id;
    if (!isOwnerForStatus && product.product_status !== 'published') {
      return NextResponse.json(
        {
          status: "error",
          message: "Product is not available",
        },
        { status: 400 }
      );
    }

    // KYC gating: if viewer is not the owner and owner's KYC not approved, block
    const isOwner = product.user_id === user_id;
    const ownerApproved =
      product?.User?.MarketplaceKycVerification?.status === "approved" ||
      User.isKycExempt(product?.User);
    if (!isOwner && !ownerApproved) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product is not available",
        },
        { status: 403 }
      );
    }

    // Check if product is already in wishlist
    const existingWishlistItem = await MarketplaceWishlists.findOne({
      where: {
        user_id,
        marketplace_product_id: product.id,
      },
    });

    if (existingWishlistItem) {
      // Remove from wishlist
      await existingWishlistItem.destroy();
      return NextResponse.json(
        {
          status: "success",
          message: "Product removed from wishlist",
          inWishlist: false,
        },
        { status: 200 }
      );
    } else {
      // Add to wishlist
      await MarketplaceWishlists.create({
        user_id,
        marketplace_product_id: product.id,
      });
      return NextResponse.json(
        {
          status: "success",
          message: "Product added to wishlist",
          inWishlist: true,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error managing wishlist:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to update wishlist"
          : (error?.message || "Failed to update wishlist"),
      },
      { status: 500 }
    );
  }
}
