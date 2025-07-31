import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
//import sequelize from "../../../models/database";

const { MarketplaceCategory, MarketplaceSubCategory } = db;

export async function GET(request, { params }) {
  const { slug } = await params;

  try {
    if (!slug) {
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
        slug: slug,
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
    console.error("Error:", error.message);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
