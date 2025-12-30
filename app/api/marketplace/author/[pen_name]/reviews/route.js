import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { Op } from "sequelize";

const { User, MarketplaceProduct, MarketplaceReview } = db;

export async function GET(request, { params }) {
  const getParams = await params;
  const { pen_name } = getParams;
  const penNameRaw = pen_name == null ? "" : String(pen_name).trim();
  const { searchParams } = new URL(request.url);

  // Pagination parameters
  const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
  const limitParam = Number.parseInt(searchParams.get("limit") || "10", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 50)
    : 10;
  const offset = (page - 1) * limit;

  // Filter parameters
  const rating = (searchParams.get('rating') || "").slice(0, 10); // Filter by specific rating
  const sortBy = (searchParams.get('sortBy') || 'newest').slice(0, 50); // newest, oldest, rating-high, rating-low

  try {
    if (!penNameRaw || penNameRaw.length > 80) {
      return NextResponse.json(
        {
          status: "error",
          message: "Author not found",
        },
        { status: 404 }
      );
    }

    // Find author first
    const author = await User.findOne({
      where: { pen_name: penNameRaw },
      attributes: ['id']
    });

    if (!author) {
      return NextResponse.json(
        {
          status: "error",
          message: "Author not found",
        },
        { status: 404 }
      );
    }

    // Build where conditions for reviews
    const reviewWhere = { visible: true };
    if (rating) {
      const ratingValue = Number.parseInt(String(rating), 10);
      if (Number.isFinite(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
        reviewWhere.rating = ratingValue;
      }
    }

    // Build order clause
    let orderClause;
    switch (sortBy) {
      case 'oldest':
        orderClause = [['createdAt', 'ASC']];
        break;
      case 'rating-high':
        orderClause = [['rating', 'DESC']];
        break;
      case 'rating-low':
        orderClause = [['rating', 'ASC']];
        break;
      default: // newest
        orderClause = [['createdAt', 'DESC']];
    }

    // Get reviews with pagination
    const { count, rows: reviews } = await MarketplaceReview.findAndCountAll({
      where: reviewWhere,
      include: [
        {
          model: MarketplaceProduct,
          where: { user_id: author.id },
          attributes: ['id', 'title', 'image'],
          required: true
        },
        {
          model: User,
          attributes: ['id', 'name', 'image'],
          required: false
        }
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true
    });

    // Format reviews for response
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      product: {
        id: review.MarketplaceProduct.id,
        title: review.MarketplaceProduct.title,
        image: review.MarketplaceProduct.image
      },
      user: review.User ? {
        id: review.User.id,
        name: review.User.name,
        image: review.User.image
      } : null
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasMore = page < totalPages;

    // Get rating distribution for author's products
    const ratingDistribution = await MarketplaceReview.findAll({
      attributes: [
        [db.sequelize.col('MarketplaceReview.rating'), 'rating'],
        [db.sequelize.fn('COUNT', db.sequelize.col('MarketplaceReview.id')), 'count']
      ],
      include: [{
        model: MarketplaceProduct,
        where: { user_id: author.id },
        attributes: []
      }],
      group: [db.sequelize.col('MarketplaceReview.rating')],
      order: [[db.sequelize.col('MarketplaceReview.rating'), 'DESC']],
      raw: true
    });

    return NextResponse.json({
      status: "success",
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasMore
      },
      ratingDistribution: ratingDistribution.reduce((acc, item) => {
        acc[item.rating] = parseInt(item.count);
        return acc;
      }, {})
    });
  } catch (error) {
    console.error("Error fetching author reviews:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to fetch reviews"
          : (error?.message || "Failed to fetch reviews"),
      },
      { status: 500 }
    );
  }
}