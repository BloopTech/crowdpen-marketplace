import { NextResponse } from "next/server";
import { db } from "../../../../../../models/index";

const { MarketplaceReview, User } = db;

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
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
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

    // Fetch reviews for the product with user information and pagination
    const { count, rows: reviews } = await MarketplaceReview.findAndCountAll({
      where: {
        marketplace_product_id: productId,
        visible: true,
      },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // Format reviews for frontend
    const formattedReviews = reviews.map(review => ({
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

    // Calculate review statistics (for all reviews, not just current page)
    const allReviews = await MarketplaceReview.findAll({
      where: {
        marketplace_product_id: productId,
        visible: true,
      },
      attributes: ['rating'],
    });
    
    const totalReviews = count;
    const averageRating = allReviews.length > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length 
      : 0;
    
    const ratingDistribution = {
      5: allReviews.filter(r => r.rating === 5).length,
      4: allReviews.filter(r => r.rating === 4).length,
      3: allReviews.filter(r => r.rating === 3).length,
      2: allReviews.filter(r => r.rating === 2).length,
      1: allReviews.filter(r => r.rating === 1).length,
    };

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalReviews / limit);
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
          totalItems: totalReviews,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
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
