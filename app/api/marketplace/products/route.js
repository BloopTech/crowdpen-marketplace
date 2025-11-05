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
} = db;

export async function GET(request) {
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id || null;

  try {
    //await sequelize.transaction(async (t) => {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");
    const tag = searchParams.get("tag");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const rating = searchParams.get("rating");
    const sort = searchParams.get("sort");
    const search = searchParams.get("search");
    const fileType = searchParams.get("fileType");
    const deliveryTime = searchParams.get("deliveryTime");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");

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
    if (minPrice) {
      where.price = { ...where.price, [Op.gte]: parseFloat(minPrice) };
    }

    if (maxPrice) {
      where.price = { ...where.price, [Op.lte]: parseFloat(maxPrice) };
    }

    if (rating) {
      where.rating = { [Op.gte]: parseFloat(rating) };
    }

    if (search) {
      // Use proper Sequelize operators for search
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
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
    let order = [];
    switch (sort) {
      case "price-low":
        order.push(["price", "ASC"]);
        break;
      case "price-high":
        order.push(["price", "DESC"]);
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
      EXISTS (
        SELECT 1
        FROM "marketplace_kyc_verifications" AS mkv
        WHERE mkv.user_id = "MarketplaceProduct"."user_id"
          AND mkv.status = 'approved'
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
    const finalWhere = { [Op.and]: [ where, { [Op.or]: visibilityOr }, { [Op.or]: flaggedOr } ] };

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
        "originalPrice",
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
        [rankScoreLiteral, 'rankScore']
      ],
      //transaction: t,
    });

    const productIDs = products?.map((product) => product?.id);

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

      return {
        ...productJson,
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
    console.error("Error:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error details:", JSON.stringify(error, null, 2));

    return NextResponse.json(
      {
        error: "Failed to fetch products",
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
