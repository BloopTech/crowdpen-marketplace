import { NextResponse } from "next/server";
import { db } from "../../../../../models";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../api/auth/[...nextauth]/route";
import { Op } from "sequelize";

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
} = db;

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Product ID is required" },
      { status: 400 }
    );
  }

  const userId = session?.user?.id || null;

  try {
    const idParam = String(id);
    const orConditions = [{ product_id: idParam }];
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idParam
      )
    ) {
      orConditions.unshift({ id: idParam });
    }

    const product = await MarketplaceProduct.findOne({
      where: {
        //[Op.or]: orConditions,
        [Op.or]: [{ id: id }, { product_id: id }],
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
      product?.User?.MarketplaceKycVerification?.status === "approved";
    if (!isOwner && !ownerApproved) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Flagged gating: hide if not owner and product is flagged
    if (!isOwner && product?.flagged === true) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
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

    const getProduct = {
      ...product?.toJSON(),
      Cart: carts,
      wishlist: wishlists,
      salesCount,
      isBestseller,
    };

    return NextResponse.json(getProduct);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
