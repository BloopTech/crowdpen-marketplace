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
    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    const now = new Date();
    const fromDate =
      parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    const sql = `
      SELECT
        o."paymentStatus" AS "paymentStatus",
        COUNT(DISTINCT o."id")::bigint AS "orderCount",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "grossRevenue",
        COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal"
      FROM "marketplace_orders" AS o
      LEFT JOIN "marketplace_order_items" AS oi ON oi."marketplace_order_id" = o."id"
      LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"
      WHERE o."createdAt" >= :from
        AND o."createdAt" <= :to
      GROUP BY 1
      ORDER BY "grossRevenue" DESC
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { from: fromDate, to: toDate },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const data = (rows || []).map((r) => {
      const grossRevenue = Number(r?.grossRevenue || 0) || 0;
      const discountTotal = Number(r?.discountTotal || 0) || 0;
      return {
        paymentStatus: r?.paymentStatus,
        orderCount: Number(r?.orderCount || 0) || 0,
        grossRevenue,
        discountTotal,
        buyerPaid: Math.max(0, grossRevenue - discountTotal),
      };
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      data,
    });
  } catch (error) {
    console.error("/api/admin/analytics/payment-status error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
