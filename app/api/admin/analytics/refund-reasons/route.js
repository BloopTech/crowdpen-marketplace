import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function parseDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const limitParam = Number(searchParams.get("limit") || 20);

    const now = new Date();
    const fromDate =
      parseDateSafe(fromParam) || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;
    const limit = Math.min(Math.max(limitParam, 1), 100);

    const sql = `
      SELECT
        COALESCE(NULLIF(TRIM(reason_category), ''), 'Uncategorized') AS "reasonCategory",
        COALESCE(NULLIF(TRIM(reason), ''), 'Unknown') AS "reason",
        COUNT(*)::bigint AS "count",
        COALESCE(SUM(COALESCE(refund_amount, 0)::numeric), 0)::numeric AS "refundAmount"
      FROM marketplace_refunds
      WHERE "createdAt" >= :from
        AND "createdAt" <= :to
      GROUP BY 1, 2
      ORDER BY "refundAmount" DESC, "count" DESC
      LIMIT :limit
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { from: fromDate, to: toDate, limit },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      data: rows || [],
    });
  } catch (error) {
    console.error("/api/admin/analytics/refund-reasons error", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed" },
      { status: 500 }
    );
  }
}
