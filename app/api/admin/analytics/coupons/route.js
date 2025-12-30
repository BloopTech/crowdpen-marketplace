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
    const limitParam = Number.parseInt(searchParams.get("limit") || "10", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 10;

    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    const now = new Date();
    const fromDate =
      parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    const sql = `
      SELECT
        UPPER(TRIM(o."couponCode")) AS "couponCode",
        COUNT(*)::bigint AS "orderCount",
        COALESCE(SUM((o."discount")::numeric), 0) AS "discountTotal",
        COALESCE(SUM((o."total")::numeric), 0) AS "orderTotal"
      FROM "marketplace_orders" AS o
      WHERE LOWER(o."paymentStatus"::text) IN ('successful', 'completed')
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
        AND o."couponCode" IS NOT NULL
        AND TRIM(o."couponCode") <> ''
      GROUP BY 1
      ORDER BY "discountTotal" DESC
      LIMIT :limit
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { from: fromDate, to: toDate, limit },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const data = (rows || []).map((r) => ({
      couponCode: r?.couponCode,
      orderCount: Number(r?.orderCount || 0) || 0,
      discountTotal: Number(r?.discountTotal || 0) || 0,
      orderTotal: Number(r?.orderTotal || 0) || 0,
    }));

    const totals = {
      orderCount: data.reduce((acc, r) => acc + (Number(r.orderCount) || 0), 0),
      discountTotal: data.reduce((acc, r) => acc + (Number(r.discountTotal) || 0), 0),
      orderTotal: data.reduce((acc, r) => acc + (Number(r.orderTotal) || 0), 0),
    };

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      limit,
      totals,
      data,
    });
  } catch (error) {
    console.error("/api/admin/analytics/coupons error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
