import { NextResponse } from "next/server";
import { db } from "../../../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { validate as isUUID } from "uuid";
import { Op } from "sequelize";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../../../lib/security/rateLimit";
import { getRequestIdFromHeaders, reportError } from "../../../../../../../lib/observability/reportError";

const { MarketplaceReview, User, MarketplaceProduct, MarketplaceKycVerification } = db;

export const runtime = "nodejs";

/**
 * POST handler to create a new review for a product
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response with created review
 */
export async function POST(request, { params }) {
  let getParams = null;
  try {
    getParams = await params;
  } catch {
    getParams = null;
  }
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `review-create:${userIdForRl}:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
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

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { rating, title, content, userId: userIdFromBody } = body;

    if (
      userIdFromBody &&
      String(userIdFromBody).slice(0, 128) !== String(session.user.id)
    ) {
      return NextResponse.json(
        { status: "error", message: "Invalid user authentication" },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    const ratingValue = Number.parseInt(String(rating), 10);
    // Validate required fields
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return NextResponse.json(
        {
          status: "error",
          message: "Rating must be between 1 and 5",
        },
        { status: 400 }
      );
    }

    const contentText = typeof content === "string" ? content : "";
    if (!contentText || contentText.trim().length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Review content is required",
        },
        { status: 400 }
      );
    }

    if (contentText.length > 10_000) {
      return NextResponse.json(
        {
          status: "error",
          message: "Review content is too long",
        },
        { status: 413 }
      );
    }

    const idParam = String(productIdRaw);
    const orConditions = [{ product_id: idParam }];
    if (isUUID(idParam)) {
      orConditions.unshift({ id: idParam });
    }

    const product = await MarketplaceProduct.findOne({
      where: {
        [Op.or]: orConditions,
      },
      attributes: ["id", "product_id", "user_id", "product_status", "flagged"],
      include: [
        {
          model: User,
          attributes: ["id", "role", "crowdpen_staff", "merchant"],
          required: false,
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
          message: "Product does not exist",
        },
        { status: 400 }
      );
    }

    const isOwnerForVisibility = String(product.user_id) === String(userId);
    const ownerApproved =
      product?.User?.MarketplaceKycVerification?.status === "approved" ||
      User.isKycExempt(product?.User) ||
      product?.User?.merchant === true;
    if (!isOwnerForVisibility) {
      if (!ownerApproved || product?.flagged === true || product?.product_status !== "published") {
        return NextResponse.json(
          {
            status: "error",
            message: "Product is not available",
          },
          { status: 400 }
        );
      }
    }

    if (String(product.user_id) === String(userId)) {
      return NextResponse.json(
        {
          status: "error",
          message: "You can't review your own product",
        },
        { status: 403 }
      );
    }

    // Check if user has already reviewed this product
    const existingReview = await MarketplaceReview.findOne({
      where: {
        user_id: userId,
        marketplace_product_id: product.id,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        {
          status: "error",
          message: "You have already reviewed this product",
        },
        { status: 409 }
      );
    }

    // Create the review
    const newReview = await MarketplaceReview.create({
      marketplace_product_id: product.id,
      user_id: userId,
      rating: ratingValue,
      title: title?.trim() || null,
      content: contentText,
      verifiedPurchase: false, // TODO: Check if user actually purchased the product
      visible: true,
    });

    // Fetch the created review with user information
    const reviewWithUser = await MarketplaceReview.findByPk(newReview.id, {
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
      ],
    });

    // Format the response
    const formattedReview = {
      id: reviewWithUser.id,
      rating: reviewWithUser.rating,
      title: reviewWithUser.title,
      content: reviewWithUser.content,
      verifiedPurchase: reviewWithUser.verifiedPurchase,
      helpful: reviewWithUser.helpful,
      createdAt: reviewWithUser.createdAt,
      updatedAt: reviewWithUser.updatedAt,
      user: {
        id: reviewWithUser.User.id,
        name: reviewWithUser.User.name,
        email: reviewWithUser.User.email,
      },
    };

    return NextResponse.json({
      status: "success",
      message: "Review created successfully",
      data: {
        review: formattedReview,
      },
    });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/item/[id]/reviews/create",
      method: "POST",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "product_review_create",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to create review"
          : (error?.message || "Failed to create review"),
      },
      { status: 500 }
    );
  }
}
