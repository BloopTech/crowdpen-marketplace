import { NextResponse } from "next/server";
import { db } from "../../../models";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";
//import sequelize from "../../../models/database";

const { MarketplaceTags } = db;

export const runtime = "nodejs";

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  try {
    //await sequelize.transaction(async (t) => {
      const tags = await MarketplaceTags.findAll({
        //transaction: t,
      });

      return NextResponse.json(tags);
    //});
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/tags",
      method: "GET",
      status: 500,
      requestId,
      tag: "marketplace_tags",
    });
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}
