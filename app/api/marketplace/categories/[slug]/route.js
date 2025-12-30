import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
//import sequelize from "../../../models/database";

const { MarketplaceCategory, MarketplaceSubCategory } = db;

export async function GET(request, { params }) {
  const { slug } = await params;
  const slugRaw = slug == null ? "" : String(slug).trim();
  const normalizedSlug = slugRaw.replace(/&/g, "and").slice(0, 100);

  try {
    if (!normalizedSlug) {
      return NextResponse.json(
        {
          error: "Slug is required",
        },
        { status: 400 }
      );
    }

    // Find single category by slug
    const category = await MarketplaceCategory.findOne({
      include: [
        {
          model: MarketplaceSubCategory,
          // Use the same name as defined in the hasMany association
        },
      ],
      where: {
        slug: normalizedSlug,
      },
    });

    if (!category) {
      return NextResponse.json(
        {
          error: "Category not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "Failed to fetch category",
        ...(isProd ? {} : { message: error?.message }),
      },
      { status: 500 }
    );
  }
}
