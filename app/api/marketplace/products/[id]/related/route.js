import { NextResponse } from "next/server";
import { db } from "../../../../../models";
import { Op } from "sequelize";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../api/auth/[...nextauth]/route";
import { validate as isUUID } from "uuid";

const {
  MarketplaceProduct,
  User,
  MarketplaceProductTags,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceSubCategory,
  MarketplaceWishlists,
  MarketplaceCategory,
  MarketplaceKycVerification,
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceReview,
} = db;

export async function GET(request, { params }) {
  const getParams = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;
  try {
    const { id } = getParams;
    const idRaw = id == null ? "" : String(id).trim();
    if (!idRaw) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }
    if (idRaw.length > 128) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get("limit") || "5", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 20)
      : 5;

    const idParam = idRaw;
    const orConditions = [{ product_id: idParam }];
    if (isUUID(idParam)) {
      orConditions.unshift({ id: idParam });
    }

    // First, get the current product to find its category
    const currentProduct = await MarketplaceProduct.findOne({
      where: { [Op.or]: orConditions },
      include: [
        {
          model: User,
          attributes: ["id", "role", "crowdpen_staff", "merchant"],
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
    });

    if (!currentProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const viewerId = userId;
    const isOwner = viewerId && currentProduct?.user_id === viewerId;
    const ownerApproved =
      currentProduct?.User?.MarketplaceKycVerification?.status === "approved" ||
      User.isKycExempt(currentProduct?.User) ||
      currentProduct?.User?.merchant === true;
    if (!isOwner && !ownerApproved) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!isOwner && currentProduct?.flagged === true) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!isOwner && currentProduct?.product_status !== "published") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Fetch related products from the same category, excluding the current product
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
              OR u.merchant = true
            )
        )
      )
    `);
    const visibilityOr = [approvedSellerLiteral];
    const flaggedOr = [{ flagged: false }];
    const statusOr = [{ product_status: "published" }];

    const finalWhere = {
      [Op.and]: [
        {
          id: {
            [Op.ne]: currentProduct.id,
          },
          marketplace_category_id: currentProduct.marketplace_category_id,
        },
        { [Op.or]: visibilityOr },
        { [Op.or]: flaggedOr },
        { [Op.or]: statusOr },
      ],
    };

    const relatedProducts = await MarketplaceProduct.findAll({
      where: finalWhere,
      include: [
        { model: MarketplaceCategory },
        { model: MarketplaceSubCategory },
        {
          model: MarketplaceProductTags,
          as: "productTags",
        },
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
        "sale_end_date",
        "product_status",
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
        [rankScoreLiteral, "rankScore"],
      ],
      order: [
        [rankScoreLiteral, "DESC"],
        ["createdAt", "DESC"],
      ],
      limit: limit,
    });

    const productIDs = relatedProducts?.map((product) => product?.id);

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

    // Compute sales count per product from MV
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

    const wishlists = await MarketplaceWishlists.findAll({
      where: {
        user_id: userId,
        marketplace_product_id: { [Op.in]: productIDs },
      },
    });

    const productUserIDs = relatedProducts?.map((product) => product?.user_id);

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

    // Format the response data
    const formattedProducts = relatedProducts.map((product) => {
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
      success: true,
      data: {
        products: formattedProducts,
        category: currentProduct.category,
        total: formattedProducts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching related products:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
