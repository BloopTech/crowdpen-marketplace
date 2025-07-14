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
