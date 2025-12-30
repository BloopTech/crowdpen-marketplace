import { NextResponse } from "next/server";
import {db} from "../../../models/index";
//import sequelize from "../../../models/database";

const { MarketplaceCategory, MarketplaceSubCategory } = db;

export async function GET(request) {
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
    console.error("Error:", error);
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
