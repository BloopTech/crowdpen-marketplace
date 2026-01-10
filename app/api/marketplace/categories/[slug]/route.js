import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";
//import sequelize from "../../../models/database";

const { MarketplaceCategory, MarketplaceSubCategory } = db;

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
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
    await reportError(error, {
      route: "/api/marketplace/categories/[slug]",
      method: "GET",
      status: 500,
      requestId,
      tag: "marketplace_category_get",
    });
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
