import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { Op } from "sequelize";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { getRequestIdFromHeaders, reportError } from "../../../../../lib/observability/reportError";

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
  MarketplaceSubCategory,
} = db;

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id || null;
  const requestId = getRequestIdFromHeaders(request.headers);

  const getParams = await params;
  const { pen_name } = getParams;
  const penNameRaw = pen_name == null ? "" : String(pen_name).trim();
  const { searchParams } = new URL(request.url);

  // Pagination parameters
  const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
  const limitParam = Number.parseInt(searchParams.get("limit") || "20", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 50)
    : 20;
  const offset = (page - 1) * limit;

  // Filter parameters
  const search = (searchParams.get("search") || "").slice(0, 200);
  const category = (searchParams.get("category") || "").slice(0, 100);
  const sortBy = (searchParams.get("sortBy") || "newest").slice(0, 50);
  const status = (searchParams.get("status") || "").slice(0, 20);

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
      attributes: ["id", "role", "crowdpen_staff", "merchant"],
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
    const effectivePriceLiteral = db.sequelize.literal(
      `CASE WHEN "MarketplaceProduct"."sale_end_date" IS NOT NULL AND "MarketplaceProduct"."sale_end_date" < NOW() AND "MarketplaceProduct"."originalPrice" IS NOT NULL AND "MarketplaceProduct"."originalPrice" > "MarketplaceProduct"."price" THEN "MarketplaceProduct"."originalPrice" ELSE "MarketplaceProduct"."price" END`
    );
    let orderClause;
    switch (sortBy) {
      case "price-low":
        orderClause = [[effectivePriceLiteral, "ASC"]];
        break;
      case "price-high":
        orderClause = [[effectivePriceLiteral, "DESC"]];
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
        orderClause = [
          [rankScoreLiteral, "DESC"],
          ["createdAt", "DESC"],
        ];
    }

    // Enforce KYC visibility: if author not approved and viewer is not the author, return empty set
    const authorKyc = await MarketplaceKycVerification.findOne({
      where: { user_id: author.id },
      attributes: ["status"],
      raw: true,
    });
    const isViewerAuthor = Boolean(userId && userId === author.id);
    if (
      !isViewerAuthor &&
      authorKyc?.status !== "approved" &&
      !User.isKycExempt(author) &&
      author?.merchant !== true
    ) {
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

    if (!isViewerAuthor) {
      whereConditions.product_status = "published";
    } else if (status && status !== "all") {
      // Owner can filter by status
      whereConditions.product_status = status;
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
        { model: MarketplaceSubCategory, attributes: ["name", "id"] },
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true,
      attributes: {
        include: [[rankScoreLiteral, "rankScore"]],
      },
    });

    const productIDs = products?.map((product) => product?.id);

    // Compute sales count per product from completed orders
    const BESTSELLER_MIN_SALES = Number(
      process.env.BESTSELLER_MIN_SALES || 100
    );
    let salesMap = {};
    if (productIDs && productIDs.length) {
      const salesRows = await db.sequelize.query(
        'SELECT "marketplace_product_id", "sales_count" FROM "mv_product_sales" WHERE "marketplace_product_id" IN (:ids)',
        {
          replacements: { ids: productIDs },
          type: db.Sequelize.QueryTypes.SELECT,
        }
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

    let reviewAggMap = {};
    if (productIDs && productIDs.length) {
      const reviewAggRows = await MarketplaceReview.findAll({
        where: {
          marketplace_product_id: { [Op.in]: productIDs },
          visible: true,
        },
        attributes: [
          "marketplace_product_id",
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
          [db.Sequelize.fn("AVG", db.Sequelize.col("rating")), "avg"],
        ],
        group: ["marketplace_product_id"],
        raw: true,
      });

      reviewAggRows.forEach((row) => {
        const pid = row.marketplace_product_id;
        const count = Number(row.count || 0) || 0;
        const avgRaw = Number(row.avg || 0) || 0;
        const avg = Math.round(avgRaw * 10) / 10;
        reviewAggMap[pid] = { count, avg };
      });
    }

    let reviewTotalMap = {};
    if (productIDs && productIDs.length) {
      const reviewTotalRows = await MarketplaceReview.findAll({
        where: {
          marketplace_product_id: { [Op.in]: productIDs },
        },
        attributes: [
          "marketplace_product_id",
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
        ],
        group: ["marketplace_product_id"],
        raw: true,
      });

      reviewTotalRows.forEach((row) => {
        const pid = row.marketplace_product_id;
        reviewTotalMap[pid] = Number(row.count || 0) || 0;
      });
    }

    let orderItemMap = {};
    if (productIDs && productIDs.length) {
      const orderItemRows = await MarketplaceOrderItems.findAll({
        where: {
          marketplace_product_id: { [Op.in]: productIDs },
        },
        attributes: [
          "marketplace_product_id",
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
        ],
        group: ["marketplace_product_id"],
        raw: true,
      });

      orderItemRows.forEach((row) => {
        const pid = row.marketplace_product_id;
        orderItemMap[pid] = Number(row.count || 0) || 0;
      });
    }

    const productsWithStats = products.map((product) => {
      const productJson = product.toJSON();

      const priceNum = Number(productJson.price);
      const originalPriceNum = Number(productJson.originalPrice);
      const hasDiscount =
        Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
      const saleEndMs = productJson.sale_end_date
        ? new Date(productJson.sale_end_date).getTime()
        : null;
      const isExpired =
        hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
      const effectivePrice = isExpired
        ? productJson.originalPrice
        : productJson.price;

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

      const reviewAgg = reviewAggMap[productJson.id];
      const reviewCount = Number(reviewAgg?.count || 0) || 0;
      const rating = Number.isFinite(reviewAgg?.avg) ? reviewAgg.avg : 0;

      const totalReviews = reviewTotalMap[productJson.id] || 0;
      const totalOrderItems = orderItemMap[productJson.id] || 0;
      const canDelete = Boolean(isViewerAuthor && totalReviews === 0 && totalOrderItems === 0);

      return {
        id: productJson.id,
        title: productJson.title,
        description: productJson.description,
        product_status: productJson.product_status,
        flagged: productJson.flagged,
        price: effectivePrice,
        originalPrice: productJson.originalPrice,
        stock: productJson.stock,
        inStock: productJson.inStock,
        featured: productJson.featured,
        image: productJson.image,
        category: productJson.MarketplaceCategory?.name,
        subCategory: productJson.MarketplaceSubCategory?.name,
        categorySlug: productJson.MarketplaceCategory?.slug,
        rating,
        reviewCount,
        salesCount,
        isBestseller,
        canDelete,
        createdAt: productJson.createdAt,
        wishlist: getWishes,
        Cart: getCart,
        product_id: productJson?.product_id,
      };
    });

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
    await reportError(error, {
      tag: "author_products_get",
      route: "/api/marketplace/author/[pen_name]/products",
      method: "GET",
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to fetch products"
          : (error?.message || "Failed to fetch products"),
      },
      { status: 500 }
    );
  }
}
