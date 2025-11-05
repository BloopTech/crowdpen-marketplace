import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { Op } from "sequelize";

const {
  MarketplaceWishlists,
  MarketplaceProduct,
  User,
  MarketplaceCategory,
  MarketplaceSubCategory,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceKycVerification,
  MarketplaceOrder,
  MarketplaceOrderItems,
} = db;

export async function GET(request, { params }) {
  const getParams = await params;

  try {
    const { pen_name } = getParams;

    if (!pen_name) {
      return NextResponse.json(
        { error: "Pen name is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Pagination parameters
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 12;
    const offset = (page - 1) * limit;

    // Filter parameters
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const sortBy = searchParams.get("sort") || "createdAt";
    const sortOrder = searchParams.get("order") || "desc";
    const minPrice = parseFloat(searchParams.get("minPrice")) || 0;
    const maxPrice = parseFloat(searchParams.get("maxPrice")) || 10000;

    // Find user by pen_name
    const user = await User.findOne({
      where: { pen_name },
      attributes: ["id", "pen_name", "name"],
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build where conditions for products
    const productWhereConditions = {
      [Op.and]: [
        minPrice > 0 || maxPrice < 10000
          ? {
              price: {
                [Op.between]: [minPrice, maxPrice],
              },
            }
          : {},
        search
          ? {
              [Op.or]: [
                { title: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } },
                { tags: { [Op.iLike]: `%${search}%` } },
              ],
            }
          : {},
        category ? { category } : {},
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    // Determine viewer for KYC gating
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id || null;

    // Build KYC gating condition: approved owners or viewer is the product owner
    const approvedSellerLiteral = db.Sequelize.literal(`
      EXISTS (
        SELECT 1
        FROM "marketplace_kyc_verifications" AS mkv
        WHERE mkv.user_id = "MarketplaceProduct"."user_id"
          AND mkv.status = 'approved'
      )
    `);
    const kycOr = [approvedSellerLiteral];
    if (viewerId) {
      kycOr.push({ user_id: viewerId });
    }

    // Build final product where
    const productWhere = {
      [Op.and]: [
        ...(productWhereConditions?.[Op.and] || []),
        { [Op.or]: kycOr },
      ],
    };

    // Rank score for ordering
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

    // Get wishlist items with pagination
    const orderClause = (
      sortBy === "price" || sortBy === "title"
    )
      ? [["MarketplaceProduct", sortBy === "price" ? "price" : "title", sortOrder.toUpperCase()]]
      : (sortBy === "bestsellers" || sortBy === "sales")
        ? [[salesCountLiteral, sortOrder.toUpperCase()]]
        : [[rankScoreLiteral, "DESC"], ["MarketplaceProduct", "createdAt", sortOrder.toUpperCase()]];

    const { count, rows: wishlistItems } = await MarketplaceWishlists.findAndCountAll({
      where: { user_id: user.id },
      include: [
        {
          model: MarketplaceProduct,
          where: productWhere,
          include: [
            {
              model: User,
              attributes: ["id", "pen_name", "name", "image", "color"],
              include: [
                { model: MarketplaceKycVerification, attributes: ["status"], required: false },
              ],
            },
            {
              model: MarketplaceCategory,
              attributes: ["id", "name", "description"],
            },
            { model: MarketplaceSubCategory },
          ],
        },
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true,
    });

    const productIDs = wishlistItems?.map((item) => item?.marketplace_product_id);

    // Compute sales count per product
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
        user_id: user.id,
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

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Format response data
    const products = wishlistItems.map((item) => {
      const getCart = carts.filter((cart) =>
        cart.cartItems?.find(
          (cartItem) => cartItem.marketplace_product_id === item.toJSON().id
        )
      );
      const salesCount = salesMap[item.toJSON().marketplace_product_id] || 0;
      const isBestseller = salesCount >= BESTSELLER_MIN_SALES;
      return {
        ...item?.MarketplaceProduct?.toJSON(),
        wishlist: [
          {
            id: item.toJSON().id,
            user_id: item.toJSON().user_id,
            marketplace_product_id: item.toJSON().marketplace_product_id,
          },
        ],
        Cart: getCart,
        salesCount,
        isBestseller,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
        filters: {
          search,
          category,
          sortBy,
          sortOrder,
          minPrice,
          maxPrice,
        },
        user: {
          id: user.id,
          pen_name: user.pen_name,
          name: user.name,
        },
      },
    });
  } catch (error) {
    console.error("Wishlist API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
