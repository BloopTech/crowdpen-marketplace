import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { Op } from "sequelize";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

const { User, MarketplaceProduct, MarketplaceReview, MarketplaceCategory } = db;

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  const getParams = await params;
  const { pen_name } = getParams;
  const penNameRaw = pen_name == null ? "" : String(pen_name).trim();

  if (!penNameRaw || penNameRaw.length > 80) {
    return NextResponse.json(
      {
        status: "error",
        message: "Author not found",
      },
      { status: 404 }
    );
  }

  try {
    // Find author with comprehensive data
    const author = await User.findOne({
      where: {
        pen_name: penNameRaw,
      },
      attributes: [
        "id",
        "name",
        "pen_name",
        "email",
        "image",
        "cover_image",
        "creator",
        "verification_badge",
        "subscribed",
        "createdAt",
        "description",
        "description_other",
        "created_date",
        "residence",
        "color",
        "lastLoginDate",
        "merchant"
      ],
      // Products and reviews are fetched separately via paginated endpoints
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

    // Calculate author statistics using separate queries for better performance
    const totalProducts = await MarketplaceProduct.count({
      where: { user_id: author.id, product_status: "published" }
    });
    
    const salesRows = await db.sequelize.query(
      'SELECT COALESCE(SUM(s."sales_count"), 0) AS "totalSales"\n'
        + 'FROM "mv_product_sales" AS s\n'
        + 'JOIN "marketplace_products" AS p ON p."id" = s."marketplace_product_id"\n'
        + 'WHERE p."user_id" = :userId\n'
        + '  AND p."product_status" = :publishedStatus',
      {
        replacements: { userId: author.id, publishedStatus: "published" },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );
    const totalSales = Number(salesRows?.[0]?.totalSales || 0) || 0;
    
    // Calculate average rating from reviews
    const reviewStats = await MarketplaceReview.findAll({
      attributes: [
        [db.sequelize.fn('AVG', db.sequelize.col('MarketplaceReview.rating')), 'averageRating'],
        [db.sequelize.fn('COUNT', db.sequelize.col('MarketplaceReview.id')), 'totalReviews']
      ],
      include: [{
        model: MarketplaceProduct,
        where: { user_id: author.id, product_status: "published" },
        attributes: []
      }],
      raw: true
    });
    
    const averageRating = reviewStats[0]?.averageRating ? parseFloat(reviewStats[0].averageRating).toFixed(1) : 0;
    const totalReviews = parseInt(reviewStats[0]?.totalReviews) || 0;
    
    // Get product categories
    const categoryResults = await MarketplaceProduct.findAll({
      where: { user_id: author.id, product_status: "published" },
      include: [{
        model: MarketplaceCategory,
        attributes: ['name']
      }],
      attributes: [],
      group: ['MarketplaceCategory.name'],
      raw: true
    });
    
    const categories = categoryResults.map(result => result['MarketplaceCategory.name']).filter(Boolean);
    
    // Format author data
    const authorData = {
      id: author.id,
      name: author.name,
      pen_name: author.pen_name,
      email: author.email,
      image: author.image,
      cover_image: author.cover_image,
      color: author.color,
      residence: author.residence || "Remote",
      bio: author.description || author.description_other,
      website: author.website || "",
      social: {
        twitter: author.twitter || "",
        linkedin: author.linkedin || "",
        instagram: author.instagram || ""
      },
      verification_badge: author.verification_badge,
      creator: author.creator,
      merchant: author?.merchant,
      subscribed: author.subscribed,
      joinDate: author.created_date,
      lastLoginDate: author.lastLoginDate,
      stats: {
        totalProducts,
        totalSales,
        averageRating: parseFloat(averageRating),
        totalReviews,
        categories,
        followers: Math.floor(Math.random() * 5000) + 100, // Mock data for now
        responseRate: Math.floor(Math.random() * 20) + 80 // Mock data for now
      }
      // Products are fetched separately via /api/marketplace/author/[pen_name]/products
    };

    return NextResponse.json({
      status: "success",
      message: "Author found",
      author: authorData,
    });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/author/[pen_name]",
      method: "GET",
      status: 500,
      requestId,
      tag: "marketplace_author_get",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to fetch author"
          : (error?.message || "Failed to fetch author"),
      },
      { status: 500 }
    );
  }
}