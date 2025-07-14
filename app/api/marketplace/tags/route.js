import { NextResponse } from "next/server";
import { db } from "../../../models";
//import sequelize from "../../../models/database";

const { MarketplaceTags } = db;

export async function GET() {
  try {
    //await sequelize.transaction(async (t) => {
      const tags = await MarketplaceTags.findAll({
        //transaction: t,
      });

      return NextResponse.json(tags);
    //});
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}
