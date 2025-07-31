import { NextResponse } from "next/server";
import { db } from "../../../../../models";
import { Op } from "sequelize";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../api/auth/[...nextauth]/route";

const {
  MarketplaceProduct,
  User,
  MarketplaceProductTags,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceSubCategory,
  MarketplaceWishlists,
  MarketplaceCategory,
} = db;

export async function GET(request, { params }) {
  const getParams = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;
  try {
    const { id } = getParams;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit")) || 5;

    // First, get the current product to find its category
    const currentProduct = await MarketplaceProduct.findByPk(id);
    console.log(
      "Current product for related products:",
      currentProduct?.id,
      currentProduct?.category
    );

    if (!currentProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Fetch related products from the same category, excluding the current product
    const relatedProducts = await MarketplaceProduct.findAll({
      where: {
        id: {
          [Op.ne]: id, // Exclude current product
        },
        marketplace_category_id: currentProduct.marketplace_category_id,
      },
      include: [
        { model: MarketplaceCategory },
        { model: MarketplaceSubCategory },
        {
          model: MarketplaceProductTags,
          as: "productTags",
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
      ],
      order: [
        ["createdAt", "DESC"], // Most recent first
      ],
      limit: limit,
    });

    const productIDs = relatedProducts?.map((product) => product?.id);

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

      return {
        ...productJson,
        tags,
        productTags: undefined, // Remove the nested structure
        wishlist: getWishes,
        User: getUser,
        Cart: getCart,
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
