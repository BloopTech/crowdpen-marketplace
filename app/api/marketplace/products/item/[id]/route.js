import { NextResponse } from "next/server";
import { db } from "../../../../../models";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../api/auth/[...nextauth]/route";

const {
  MarketplaceProduct,
  MarketplaceCategory,
  MarketplaceSubCategory,
  User,
  MarketplaceProductTags,
  MarketplaceWishlists,
  MarketplaceCart,
  MarketplaceCartItems,
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
    const product = await MarketplaceProduct.findByPk(id, {
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

    const getProduct = {
      ...product?.toJSON(),
      Cart: carts,
      wishlist: wishlists,
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
