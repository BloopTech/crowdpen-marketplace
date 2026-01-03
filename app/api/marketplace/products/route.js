import { NextResponse } from "next/server";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
//import sequelize from "../../../models/database";

const {
  MarketplaceProduct,
  MarketplaceProductTags,
  MarketplaceTags,
  MarketplaceCategory,
  MarketplaceSubCategory,
  MarketplaceWishlists,
  User,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceProductVariation,
  MarketplaceKycVerification,
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceReview,
} = db;

export async function GET(request) {
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id || null;

  try {
    //await sequelize.transaction(async (t) => {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get("category") || "").slice(0, 100);
    const subcategory = (searchParams.get("subcategory") || "").slice(0, 100);
    const tag = (searchParams.get("tag") || "").slice(0, 100);
    const minPrice = (searchParams.get("minPrice") || "").slice(0, 32);
    const maxPrice = (searchParams.get("maxPrice") || "").slice(0, 32);
    const rating = (searchParams.get("rating") || "").slice(0, 32);
    const sort = (searchParams.get("sort") || "").slice(0, 50);
    const search = (searchParams.get("search") || "").slice(0, 200);
    const fileType = (searchParams.get("fileType") || "").slice(0, 50);
    const deliveryTime = (searchParams.get("deliveryTime") || "").slice(0, 50);
    const contentLength = (searchParams.get("contentLength") || "").slice(0, 50);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") || "20", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 50)
      : 20;

    // Build query conditions
    let where = {};

    if (category && category !== "All") {
      const categoryRecord = await MarketplaceCategory.findOne({
        where: { name: category },
        //transaction: t,
      });
      if (categoryRecord) {
        where.marketplace_category_id = categoryRecord.id;
      }
    }

    if (subcategory) {
      const subcategoryRecord = await MarketplaceSubCategory.findOne({
        where: { name: subcategory },
        //transaction: t,
      });
      if (subcategoryRecord) {
        where.marketplace_subcategory_id = subcategoryRecord.id;
      }
    }

    if (tag) {
      // Need to join with ProductTags
      const tagRecord = await MarketplaceTags.findOne({
        where: { name: tag },
        //transaction: t,
      });
      if (tagRecord) {
        const productIds = await MarketplaceProductTags.findAll({
          where: { marketplace_tags_id: tagRecord.id },
          attributes: ["marketplace_product_id"],
          //transaction: t,
        });
        where.id = {
          [Op.in]: productIds.map((pt) => pt.marketplace_product_id),
        };
      }
    }

    // Handle price filters with proper Sequelize operators
    const minPriceValue = minPrice ? Number.parseFloat(minPrice) : null;
    const maxPriceValue = maxPrice ? Number.parseFloat(maxPrice) : null;

    if (rating) {
      const ratingValue = Number.parseFloat(rating);
      if (Number.isFinite(ratingValue)) {
        where.rating = { [Op.gte]: ratingValue };
      }
    }

    if (search) {
      // Use iLike for case-insensitive search (PostgreSQL)
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Handle fileType filter
    if (fileType) {
      where.fileType = fileType;
    }

    // Handle deliveryTime filter
    if (deliveryTime) {
      where.deliveryTime = deliveryTime;
    }

    // Handle contentLength filter
    if (contentLength) {
      where.content_length = contentLength;
    }

    // Build sort options with correct column names
    const rankScoreLiteral = db.Sequelize.literal(`
      (CASE WHEN "MarketplaceProduct"."featured" = true THEN 10 ELSE 0 END)
      + (1.5 * COALESCE("MarketplaceProduct"."rating", 0))
      + (1.0 * COALESCE("MarketplaceProduct"."authorRating", 0))
      + (0.5 * LN(COALESCE((
          SELECT s."sales_count"
          FROM "mv_product_sales" AS s
          WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
        ), 0) + 1))
    `);
    const salesCountLiteral = db.Sequelize.literal(`COALESCE((
      SELECT s."sales_count"
      FROM "mv_product_sales" AS s
      WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
    ), 0)`);
    const effectivePriceLiteral = db.Sequelize.literal(`
      CASE
        WHEN "MarketplaceProduct"."sale_end_date" IS NOT NULL
          AND "MarketplaceProduct"."sale_end_date" < NOW()
          AND "MarketplaceProduct"."originalPrice" IS NOT NULL
          AND "MarketplaceProduct"."originalPrice" > "MarketplaceProduct"."price"
        THEN "MarketplaceProduct"."originalPrice"
        ELSE "MarketplaceProduct"."price"
      END
    `);
    let order = [];
    switch (sort) {
      case "price-low":
        order.push([effectivePriceLiteral, "ASC"]);
        break;
      case "price-high":
        order.push([effectivePriceLiteral, "DESC"]);
        break;
      case "rating":
        order.push(["rating", "DESC"]);
        break;
      case "newest":
        order.push(["createdAt", "DESC"]);
        break;
      case "popular":
        order.push(["downloads", "DESC"]); // Using downloads instead of purchases
        break;
      case "bestsellers":
        order.push([salesCountLiteral, "DESC"]);
        break;
      case "featured":
        order.push(["featured", "DESC"]);
        order.push(["rating", "DESC"]);
        break;
      case "all":
      default:
        order.push([rankScoreLiteral, "DESC"]);
        order.push(["createdAt", "DESC"]);
        break;
    }

    // Pagination
    const offset = (page - 1) * limit;

    // Apply KYC visibility: show only products where owner's KYC is approved, unless viewer is the owner
    const approvedSellerLiteral = db.Sequelize.literal(`
      (
        EXISTS (
          SELECT 1
          FROM "marketplace_kyc_verifications" AS mkv
          WHERE mkv.user_id = "MarketplaceProduct"."user_id"
            AND mkv.status = 'approved'
        )
        OR EXISTS (
          SELECT 1
          FROM "users" AS u
          WHERE u.id = "MarketplaceProduct"."user_id"
            AND (
              u.crowdpen_staff = true
              OR u.role IN ('admin', 'senior_admin')
            )
        )
      )
    `);

    const visibilityOr = [approvedSellerLiteral];
    if (userId) {
      visibilityOr.push({ user_id: userId });
    }
    // Flagged gating: require flagged=false for public viewers; owners can see their own flagged items
    const flaggedOr = userId
      ? [{ flagged: false }, { user_id: userId }]
      : [{ flagged: false }];
    const statusOr = userId
      ? [{ product_status: "published" }, { user_id: userId }]
      : [{ product_status: "published" }];
    const andConditions = [
      where,
      { [Op.or]: visibilityOr },
      { [Op.or]: flaggedOr },
      { [Op.or]: statusOr },
    ];
    if (Number.isFinite(minPriceValue)) {
      andConditions.push(
        db.Sequelize.where(effectivePriceLiteral, { [Op.gte]: minPriceValue })
      );
    }
    if (Number.isFinite(maxPriceValue)) {
      andConditions.push(
        db.Sequelize.where(effectivePriceLiteral, { [Op.lte]: maxPriceValue })
      );
    }
    const finalWhere = { [Op.and]: andConditions };

    // Now try the full query
    const { count, rows: products } = await MarketplaceProduct.findAndCountAll({
      where: finalWhere,
      order,
      limit,
      offset,
      include: [
        { model: MarketplaceCategory },
        { model: MarketplaceSubCategory },
        {
          model: MarketplaceProductTags,
          as: "productTags",
        },
        // User include retained for potential future use; KYC gating handled via literal EXISTS
        {
          model: User,
          attributes: [],
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
      attributes: [
        "id",
        "title",
        "price",
        "currency",
        "originalPrice",
        "sale_end_date",
        "product_status",
        "stock",
        "inStock",
        "rating",
        "reviewCount",
        "featured",
        "createdAt",
        "updatedAt",
        "marketplace_category_id",
        "marketplace_subcategory_id",
        "user_id",
        "deliveryTime",
        "fileType",
        "image",
        "downloads",
        "product_id",
        [rankScoreLiteral, 'rankScore']
      ],
      //transaction: t,
    });

    const productIDs = products?.map((product) => product?.id);

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

    const wishlists = await MarketplaceWishlists.findAll({
      where: {
        user_id: userId,
        marketplace_product_id: { [Op.in]: productIDs },
      },
    });

    const productUserIDs = products?.map((product) => product?.user_id);

    const users = await User.findAll({
      where: {
        id: { [Op.in]: productUserIDs },
      },
      attributes: ["id", "name", "image", "pen_name"],
    });

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

    // Format products
    const formattedProducts = products.map((product) => {
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

      const getUser = users.find((user) => user.id === productJson.user_id);

      const getCart = carts.filter((cart) =>
        cart.cartItems?.find(
          (cartItem) => cartItem.marketplace_product_id === productJson.id
        )
      );

      // Extract tags from the nested association
      const tags =
        productJson.productTags?.map((pt) => pt.MarketplaceTags?.name) || [];

      const salesCount = salesMap[productJson.id] || 0;
      const isBestseller = salesCount >= BESTSELLER_MIN_SALES;

      const reviewAgg = reviewAggMap[productJson.id];
      const reviewCount = Number(reviewAgg?.count || 0) || 0;
      const rating = Number.isFinite(reviewAgg?.avg) ? reviewAgg.avg : 0;

      return {
        ...productJson,
        price: effectivePrice,
        rating,
        reviewCount,
        tags,
        productTags: undefined, // Remove the nested structure
        wishlist: getWishes,
        User: getUser,
        Cart: getCart,
        salesCount,
        isBestseller,
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
    //});
  } catch (error) {
    console.error("====== ERROR FETCHING PRODUCTS ======");
    console.error("Error:", error);
    console.error("Error name:", error?.name);

    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "Failed to fetch products",
        ...(isProd ? {} : { message: error?.message }),
      },
      { status: 500 }
    );
  }
}
