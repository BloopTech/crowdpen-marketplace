import { NextResponse } from "next/server";
import { db } from "../../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { validate as isUUID } from "uuid";
import { Op } from "sequelize";

const { MarketplaceReview, User, MarketplaceProduct } = db;

/**
 * GET handler to fetch reviews for a product
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response with reviews data
 */
export async function GET(request, { params }) {
  const getParams = await params;
  try {
    const productId = getParams.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const offset = (page - 1) * limit;

    if (!productId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product ID is required",
        },
        { status: 400 }
      );
    }

    const idParam = String(productId);
    const orConditions = [{ product_id: idParam }];
    if (isUUID(idParam)) {
      orConditions.unshift({ id: idParam });
    }

    const product = await MarketplaceProduct.findOne({
      where: {
        [Op.or]: orConditions,
      },
      attributes: ["id", "product_id"],
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

    if (String(product.user_id) === String(userId)) {
      return NextResponse.json(
        {
          status: "error",
          message: "You can't review your own product",
        },
        { status: 403 }
      );
    }

    // Fetch written reviews (with non-empty content) for the product with user information and pagination
    const { count, rows: reviews } = await MarketplaceReview.findAndCountAll({
      where: {
        marketplace_product_id: product.id,
        visible: true,
        content: { [Op.and]: [{ [Op.ne]: "" }, { [Op.not]: null }] },
      },
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Format reviews for frontend
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      verifiedPurchase: review.verifiedPurchase,
      helpful: review.helpful,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: {
        id: review.User.id,
        name: review.User.name,
        email: review.User.email,
      },
    }));

    // Calculate rating statistics (include all ratings, even rating-only without written content)
    const allRatings = await MarketplaceReview.findAll({
      where: {
        marketplace_product_id: product.id,
        visible: true,
      },
      attributes: ["rating"],
    });

    const totalReviews = allRatings.length; // total number of ratings
    const averageRating =
      allRatings.length > 0
        ? allRatings.reduce((sum, review) => sum + review.rating, 0) /
          allRatings.length
        : 0;

    const ratingDistribution = {
      5: allRatings.filter((r) => r.rating === 5).length,
      4: allRatings.filter((r) => r.rating === 4).length,
      3: allRatings.filter((r) => r.rating === 3).length,
      2: allRatings.filter((r) => r.rating === 2).length,
      1: allRatings.filter((r) => r.rating === 1).length,
    };

    // Get current user's review if logged in
    const session = await getServerSession(authOptions);
    let currentUserReview = null;
    if (session?.user?.id) {
      const myReview = await MarketplaceReview.findOne({
        where: {
          marketplace_product_id: product.id,
          user_id: session.user.id,
        },
        include: [
          {
            model: User,
            attributes: ["id", "name", "email"],
          },
        ],
      });
      if (myReview) {
        currentUserReview = {
          id: myReview.id,
          rating: myReview.rating,
          title: myReview.title,
          content: myReview.content,
          verifiedPurchase: myReview.verifiedPurchase,
          helpful: myReview.helpful,
          createdAt: myReview.createdAt,
          updatedAt: myReview.updatedAt,
          user: {
            id: myReview.User.id,
            name: myReview.User.name,
            email: myReview.User.email,
          },
        };
      }
    }

    // Calculate pagination metadata (for written reviews only)
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      status: "success",
      data: {
        reviews: formattedReviews,
        statistics: {
          totalReviews,
          averageRating: Math.round(averageRating * 10) / 10,
          ratingDistribution,
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
        currentUserReview,
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to fetch reviews",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT handler to upsert (create or update) the current user's review for a product
 */
export async function PUT(request, { params }) {
  const getParams = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const productId = getParams.id;

    if (!productId) {
      return NextResponse.json(
        { status: "error", message: "Product ID is required" },
        { status: 400 }
      );
    }

    const idParam = String(productId);
    const orConditions = [{ product_id: idParam }];
    if (isUUID(idParam)) {
      orConditions.unshift({ id: idParam });
    }

    const body = await request.json();
    const rating = parseInt(body.rating, 10);
    const title = body.title ?? null;
    const content = body.content ?? undefined; // undefined means do not change on update

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { status: "error", message: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const product = await MarketplaceProduct.findOne({
      where: {
        [Op.or]: orConditions,
      },
      attributes: ["id", "product_id", "user_id"],
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

    if (String(product.user_id) === String(userId)) {
      return NextResponse.json(
        {
          status: "error",
          message: "You can't review your own product",
        },
        { status: 403 }
      );
    }

    // Find existing review
    let review = await MarketplaceReview.findOne({
      where: {
        user_id: userId,
        marketplace_product_id: product.id,
      },
    });

    if (review) {
      // Update existing review
      review.rating = rating;
      if (title !== undefined) {
        review.title = title && String(title).trim().length > 0 ? title : null;
      }
      if (content !== undefined) {
        // Allow empty string to represent rating-only
        review.content = content ?? "";
      }
      await review.save();
    } else {
      // Create new review (content optional for rating-only)
      review = await MarketplaceReview.create({
        marketplace_product_id: product.id,
        user_id: userId,
        rating,
        title: title && String(title).trim().length > 0 ? title : null,
        content: content ?? "",
        verifiedPurchase: false,
        visible: true,
      });
    }

    // Fetch with user
    const reviewWithUser = await MarketplaceReview.findByPk(review.id, {
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
      ],
    });

    const formatted = {
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
      message: "Review saved",
      data: { review: formatted },
    });
  } catch (error) {
    console.error("Error upserting review:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to save review" },
      { status: 500 }
    );
  }
}
