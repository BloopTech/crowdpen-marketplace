import { NextResponse } from "next/server";
import { db } from "../../../../../models";

const {
  MarketplaceProduct,
  MarketplaceCategory,
  MarketplaceSubCategory,
  User,
  MarketplaceProductTags,
} = db;

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Product ID is required" },
      { status: 400 }
    );
  }

  try {
    const product = await MarketplaceProduct.findByPk(id, {
      include: [
        {
          model: MarketplaceCategory,
        },
        {
          model: MarketplaceSubCategory,
        },
        {
          model: User,
          attributes: [
            "id",
            "name",
            "email",
            "image",
            "role",
            "createdAt",
            "updatedAt",
            "color"
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

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
