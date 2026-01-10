import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

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

export const runtime = "nodejs";

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
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
        c."id" AS "id",
        c."name" AS "name",
        COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "grossRevenue",
        COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"
      LEFT JOIN "marketplace_categories" AS c ON c."id" = p."marketplace_category_id"
      WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
      GROUP BY c."id", c."name"
      ORDER BY "grossRevenue" DESC
      LIMIT :limit
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { from: fromDate, to: toDate, limit },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const data = (rows || []).map((r) => {
      const grossRevenue = Number(r?.grossRevenue || 0) || 0;
      const discountTotal = Number(r?.discountTotal || 0) || 0;
      const buyerPaid = Math.max(0, grossRevenue - discountTotal);
      return {
        id: r?.id || null,
        name: r?.name || "Uncategorized",
        unitsSold: Number(r?.unitsSold || 0) || 0,
        grossRevenue,
        discountTotal,
        buyerPaid,
        revenue: buyerPaid,
      };
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      limit,
      data,
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_analytics_category_breakdown_get",
      route: "/api/admin/analytics/category-breakdown",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
