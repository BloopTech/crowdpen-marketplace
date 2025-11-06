import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { Op } from "sequelize";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";

const {
  User,
  MarketplaceProduct,
  MarketplaceReview,
  MarketplaceCategory,
  MarketplaceCartItems,
  MarketplaceCart,
  MarketplaceWishlists,
  MarketplaceKycVerification,
  MarketplaceOrder,
  MarketplaceOrderItems,
} = db;

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id || null;

  const getParams = await params;
  const { pen_name } = getParams;
  const { searchParams } = new URL(request.url);

  // Pagination parameters
  const page = parseInt(searchParams.get("page")) || 1;
  const limit = parseInt(searchParams.get("limit")) || 12;
  const offset = (page - 1) * limit;

  // Filter parameters
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const sortBy = searchParams.get("sortBy") || "newest";

  try {
    // Find author first
    const author = await User.findOne({
      where: { pen_name },
      attributes: ["id"],
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

    // Build where conditions
    const whereConditions = {
      user_id: author.id,
    };

    // Add search filter
    if (search) {
      whereConditions[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Build category filter
    const categoryWhere = category ? { name: category } : {};

    // Build order clause
    const rankScoreLiteral = db.sequelize.literal(`
      (CASE WHEN "MarketplaceProduct"."featured" = true THEN 10 ELSE 0 END)
      + (1.5 * COALESCE("MarketplaceProduct"."rating", 0))
      + (1.0 * COALESCE("MarketplaceProduct"."authorRating", 0))
      + (0.5 * LN(COALESCE((
          SELECT s."sales_count"
          FROM "mv_product_sales" AS s
          WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
        ), 0) + 1))
    `);
    const salesCountLiteral = db.sequelize.literal(`COALESCE((
      SELECT s."sales_count"
      FROM "mv_product_sales" AS s
      WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
    ), 0)`);
    let orderClause;
    switch (sortBy) {
      case "price-low":
        orderClause = [["price", "ASC"]];
        break;
      case "price-high":
        orderClause = [["price", "DESC"]];
        break;
      case "rating":
        orderClause = [
          [
            db.sequelize.literal(
              '(SELECT AVG(rating) FROM "MarketplaceReviews" WHERE "marketplace_product_id" = "MarketplaceProduct"."id")'
            ),
            "DESC NULLS LAST",
          ],
        ];
        break;
      case "sales":
      case "bestsellers":
        orderClause = [[salesCountLiteral, "DESC"]];
        break;
      default: // default ranking
        orderClause = [[rankScoreLiteral, "DESC"], ["createdAt", "DESC"]];
    }

    // Enforce KYC visibility: if author not approved and viewer is not the author, return empty set
    const authorKyc = await MarketplaceKycVerification.findOne({ where: { user_id: author.id }, attributes: ['status'], raw: true });
    const isViewerAuthor = Boolean(userId && userId === author.id);
    if (!isViewerAuthor && authorKyc?.status !== 'approved') {
      return NextResponse.json({
        status: "success",
        products: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      });
    }

    // Flagged gating: only show non-flagged products to public viewers
    if (!isViewerAuthor) {
      whereConditions.flagged = false;
    }

    // Get products with pagination
    const { count, rows: products } = await MarketplaceProduct.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: MarketplaceCategory,
          where: categoryWhere,
          required: category ? true : false,
          attributes: ["name", "slug"],
        },
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true,
      attributes: {
        include: [[rankScoreLiteral, 'rankScore']]
      }
    });

    const productIDs = products?.map((product) => product?.id);

    // Compute sales count per product from completed orders
    const BESTSELLER_MIN_SALES = Number(process.env.BESTSELLER_MIN_SALES || 100);
    let salesMap = {};
    if (productIDs && productIDs.length) {
      const salesRows = await db.sequelize.query(
        'SELECT "marketplace_product_id", "sales_count" FROM "mv_product_sales" WHERE "marketplace_product_id" IN (:ids)',
        { replacements: { ids: productIDs }, type: db.Sequelize.QueryTypes.SELECT }
      );
      salesRows.forEach((row) => {
        salesMap[row.marketplace_product_id] = Number(row.sales_count) || 0;
      });
    }

    const carts = await MarketplaceCart.findAll({
      where: {
        user_id: userId,
      },
      include: [
        {
          model: MarketplaceCartItems,
          where: {
            marketplace_product_id: { [Op.in]: productIDs },
          },
          as: "cartItems",
        },
      ],
    });

    const wishlists = await MarketplaceWishlists.findAll({
      where: {
        user_id: userId,
        marketplace_product_id: { [Op.in]: productIDs },
      },
    });

    // Get review stats for each product
    const productsWithStats = await Promise.all(
      products.map(async (product) => {
        const productJson = product.toJSON();

        const reviewStats = await MarketplaceReview.findOne({
          where: { marketplace_product_id: productJson.id },
          attributes: [
            [
              db.sequelize.fn("AVG", db.sequelize.col("rating")),
              "averageRating",
            ],
            [db.sequelize.fn("COUNT", db.sequelize.col("id")), "reviewCount"],
          ],
          raw: true,
        });

        const getWishes = wishlists.filter(
          (wishlist) => wishlist.marketplace_product_id === productJson.id
        );

        const getCart = carts.filter((cart) =>
          cart.cartItems?.find(
            (cartItem) => cartItem.marketplace_product_id === productJson.id
          )
        );

        const salesCount = salesMap[productJson.id] || 0;
        const isBestseller = salesCount >= BESTSELLER_MIN_SALES;

        return {
          id: productJson.id,
          title: productJson.title,
          description: productJson.description,
          price: productJson.price,
          originalPrice: productJson.originalPrice,
          stock: productJson.stock,
          inStock: productJson.inStock,
          featured: productJson.featured,
          image: productJson.image,
          category: productJson.MarketplaceCategory?.name,
          categorySlug: productJson.MarketplaceCategory?.slug,
          rating: reviewStats?.averageRating
            ? parseFloat(reviewStats.averageRating).toFixed(1)
            : 0,
          reviewCount: parseInt(reviewStats?.reviewCount) || 0,
          salesCount,
          isBestseller,
          createdAt: productJson.createdAt,
          wishlist: getWishes,
          Cart: getCart,
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      status: "success",
      products: productsWithStats,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching author products:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
