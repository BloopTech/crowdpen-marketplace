import { NextResponse } from "next/server";
import { db } from "../../../../../models";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../api/auth/[...nextauth]/route";
import { Op } from "sequelize";
import { validate as isUUID } from "uuid";
import { getRequestIdFromHeaders, reportError } from "../../../../../lib/observability/reportError";

const {
  MarketplaceProduct,
  MarketplaceCategory,
  MarketplaceSubCategory,
  User,
  MarketplaceProductTags,
  MarketplaceWishlists,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceKycVerification,
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceReview,
  MarketplaceProductVariation,
  MarketplaceFunnelEvents,
} = db;

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/item/[id]",
      method: "GET",
      status: 500,
      requestId,
      userId: null,
      tag: "marketplace_product_item_get_session",
    });
    session = null;
  }

  let id;
  try {
    ({ id } = await params);
  } catch {
    return NextResponse.json(
      { error: "Product ID is required" },
      { status: 400 }
    );
  }

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

  const userId = session?.user?.id || null;

  try {
    const idParam = idRaw;
    const orConditions = [{ product_id: idParam }];
    if (isUUID(idParam)) {
      orConditions.unshift({ id: idParam });
    }

    const product = await MarketplaceProduct.findOne({
      where: {
        [Op.or]: orConditions,
        //[Op.or]: [{ id: id }, { product_id: id }],
      },
      include: [
        { model: MarketplaceCategory },
        { model: MarketplaceSubCategory },
        {
          model: User,
          attributes: [
            "id",
            "name",
            "email",
            "image",
            "role",
            "crowdpen_staff",
            "merchant",
            "description_other",
            "description",
            "color",
            "pen_name",
          ],
          include: [
            {
              model: MarketplaceKycVerification,
              attributes: ["status"],
              required: false,
            },
          ],
        },
        {
          model: MarketplaceProductTags,
          as: "productTags",
        },
      ],
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Enforce KYC visibility: if not owner and owner's KYC not approved, hide
    const viewerId = userId;
    const isOwner = viewerId && product?.user_id === viewerId;
    const ownerApproved =
      product?.User?.MarketplaceKycVerification?.status === "approved" ||
      User.isKycExempt(product?.User) ||
      product?.User?.merchant === true;
    if (!isOwner && !ownerApproved) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Flagged gating: hide if not owner and product is flagged
    if (!isOwner && product?.flagged === true) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!isOwner && product?.product_status !== "published") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let canDelete = false;
    if (isOwner) {
      const [orderItemsCount, reviewsCount] = await Promise.all([
        MarketplaceOrderItems.count({
          where: { marketplace_product_id: product?.id },
        }),
        MarketplaceReview.count({
          where: { marketplace_product_id: product?.id },
        }),
      ]);
      canDelete = Number(orderItemsCount || 0) === 0 && Number(reviewsCount || 0) === 0;
    }

    const carts = await MarketplaceCart.findAll({
      where: {
        user_id: userId,
      },
      include: [
        {
          model: MarketplaceCartItems,
          where: {
            marketplace_product_id: product?.id,
          },
          as: "cartItems",
        },
      ],
    });

    const wishlists = await MarketplaceWishlists.findAll({
      where: {
        user_id: userId,
        marketplace_product_id: product?.id,
      },
    });

    const reviewAggRows = await MarketplaceReview.findAll({
      where: {
        marketplace_product_id: product?.id,
        visible: true,
      },
      attributes: [
        [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
        [db.Sequelize.fn("AVG", db.Sequelize.col("rating")), "avg"],
      ],
      raw: true,
    });
    const totalReviews = Number(reviewAggRows?.[0]?.count || 0) || 0;
    const averageRatingRaw = Number(reviewAggRows?.[0]?.avg || 0) || 0;
    const averageRating = Math.round(averageRatingRaw * 10) / 10;

    // Compute sales count using materialized view
    const BESTSELLER_MIN_SALES = Number(
      process.env.BESTSELLER_MIN_SALES || 100
    );
    const mvRow = await db.sequelize.query(
      'SELECT "sales_count" FROM "mv_product_sales" WHERE "marketplace_product_id" = :id LIMIT 1',
      {
        replacements: { id: product?.id },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );
    const salesCount = mvRow?.[0]?.sales_count
      ? Number(mvRow[0].sales_count)
      : 0;
    const isBestseller = salesCount >= BESTSELLER_MIN_SALES;

    const productJson = product?.toJSON();
    const priceNum = Number(productJson.price);
    const originalPriceNum = Number(productJson.originalPrice);
    const hasDiscount =
      Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
    const saleEndMs = productJson.sale_end_date
      ? new Date(productJson.sale_end_date).getTime()
      : null;
    const isExpired =
      hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
    const effectivePrice = isExpired ? productJson.originalPrice : productJson.price;

    const getProduct = {
      ...productJson,
      price: effectivePrice,
      rating: averageRating,
      reviewCount: totalReviews,
      Cart: carts,
      wishlist: wishlists,
      salesCount,
      isBestseller,
      canDelete,
    };

    return NextResponse.json(getProduct);
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/item/[id]",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "marketplace_product_item_get",
    });
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/item/[id]",
      method: "DELETE",
      status: 500,
      requestId,
      userId: null,
      tag: "marketplace_product_item_delete_session",
    });
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to authenticate",
      },
      { status: 500 }
    );
  }

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        status: "error",
        message: "Authentication required",
      },
      { status: 401 }
    );
  }

  let id;
  try {
    ({ id } = await params);
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message: "Product ID is required",
      },
      { status: 400 }
    );
  }
  const idRaw = id == null ? "" : String(id).trim();
  if (!idRaw || idRaw.length > 128) {
    return NextResponse.json(
      {
        status: "error",
        message: "Product ID is required",
      },
      { status: 400 }
    );
  }

  const sessionUserId = String(session.user.id);

  try {
    const idParam = idRaw;
    const orConditions = [{ product_id: idParam }];
    if (isUUID(idParam)) {
      orConditions.unshift({ id: idParam });
    }

    const product = await MarketplaceProduct.findOne({
      where: { [Op.or]: orConditions },
      attributes: ["id", "user_id", "product_status"],
    });

    if (!product) {
      return NextResponse.json(
        {
          status: "error",
          message: "Product not found",
        },
        { status: 404 }
      );
    }

    if (String(product.user_id) !== sessionUserId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Unauthorized",
        },
        { status: 403 }
      );
    }

    const productId = product.id;

    const [orderItemsCount, reviewsCount] = await Promise.all([
      MarketplaceOrderItems.count({
        where: { marketplace_product_id: productId },
      }),
      MarketplaceReview.count({
        where: { marketplace_product_id: productId },
      }),
    ]);

    const eligibleToDelete =
      Number(orderItemsCount || 0) === 0 && Number(reviewsCount || 0) === 0;

    const archiveProduct = async () => {
      await db.sequelize.transaction(async (t) => {
        await Promise.all([
          MarketplaceCartItems.destroy({
            where: { marketplace_product_id: productId },
            transaction: t,
          }),
          MarketplaceWishlists.destroy({
            where: { marketplace_product_id: productId },
            transaction: t,
          }),
        ]);

        const fresh = await MarketplaceProduct.findOne({
          where: { id: productId },
          transaction: t,
        });
        if (fresh && fresh.product_status !== "archived") {
          await fresh.update({ product_status: "archived" }, { transaction: t });
        }
      });
    };

    if (!eligibleToDelete) {
      await archiveProduct();
      return NextResponse.json(
        {
          status: "success",
          action: "archived",
          message:
            "Product archived. Products with reviews or orders can’t be deleted.",
        },
        { status: 200 }
      );
    }

    try {
      await db.sequelize.transaction(async (t) => {
        await Promise.all([
          MarketplaceCartItems.destroy({
            where: { marketplace_product_id: productId },
            transaction: t,
          }),
          MarketplaceWishlists.destroy({
            where: { marketplace_product_id: productId },
            transaction: t,
          }),
          MarketplaceProductTags.destroy({
            where: { marketplace_product_id: productId },
            transaction: t,
          }),
          MarketplaceProductVariation.destroy({
            where: { marketplace_product_id: productId },
            transaction: t,
          }),
          MarketplaceFunnelEvents.update(
            { marketplace_product_id: null },
            { where: { marketplace_product_id: productId }, transaction: t }
          ),
        ]);

        const fresh = await MarketplaceProduct.findOne({
          where: { id: productId },
          transaction: t,
        });
        if (!fresh) return;
        await fresh.destroy({ transaction: t });
      });
    } catch (error) {
      if (
        error?.name === "SequelizeForeignKeyConstraintError" ||
        error?.parent?.code === "23503"
      ) {
        await archiveProduct();
        return NextResponse.json(
          {
            status: "success",
            action: "archived",
            message:
              "Product archived. Products with reviews or orders can’t be deleted.",
          },
          { status: 200 }
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        status: "success",
        action: "deleted",
        message: "Product deleted",
      },
      { status: 200 }
    );
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/item/[id]",
      method: "DELETE",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "marketplace_product_item_delete",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to update product"
          : (error?.message || "Failed to update product"),
      },
      { status: 500 }
    );
  }
}
