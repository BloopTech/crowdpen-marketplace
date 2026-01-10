import { NextResponse } from "next/server";
import {db} from "../../../models/index";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";
//import sequelize from "../../../models/database";

const { MarketplaceCategory, MarketplaceSubCategory } = db;

export const runtime = "nodejs";

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  try {
    //await sequelize.transaction(async (t) => {
      const categories = await MarketplaceCategory.findAll({
        include: [
          {
            model: MarketplaceSubCategory,
            // Use the same name as defined in the hasMany association
          },
        ],
        //transaction: t,
      });

      return NextResponse.json(categories);
    //});
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/categories",
      method: "GET",
      status: 500,
      requestId,
      tag: "marketplace_categories",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "Failed to fetch categories",
        ...(isProd ? {} : { message: error?.message }),
      },
      { status: 500 }
    );
  }
}
