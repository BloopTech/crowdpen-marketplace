import { NextResponse } from "next/server";
import { db } from "../../../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";

const { MarketplaceReview, User } = db;

/**
 * POST handler to create a new review for a product
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response with created review
 */
export async function POST(request, { params }) {
    const getParams = await params;
  try {
    // Get current user from session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          status: "error",
          message: "Authentication required",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const productId = getParams.id;

    if (!productId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product ID is required",
        },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { rating, title, content } = body;

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        {
          status: "error",
          message: "Rating must be between 1 and 5",
        },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Review content is required",
        },
        { status: 400 }
      );
    }

    // Check if user has already reviewed this product
    const existingReview = await MarketplaceReview.findOne({
      where: {
        user_id: userId,
        marketplace_product_id: productId,
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
      marketplace_product_id: productId,
      user_id: userId,
      rating: parseInt(rating),
      title: title?.trim() || null,
      content: content.trim(),
      verifiedPurchase: false, // TODO: Check if user actually purchased the product
      visible: true,
    });

    // Fetch the created review with user information
    const reviewWithUser = await MarketplaceReview.findByPk(newReview.id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email'],
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
    console.error("Error creating review:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to create review",
      },
      { status: 500 }
    );
  }
}
