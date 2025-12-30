import { NextResponse } from "next/server";
import { db } from "../../models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    let dbOk = true;
    try {
      if (db?.sequelize?.query) {
        await db.sequelize.query("SELECT 1");
      }
    } catch {
      dbOk = false;
    }

    if (!dbOk) {
      return NextResponse.json(
        {
          status: "degraded",
          timestamp: now.toISOString(),
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        timestamp: now.toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
