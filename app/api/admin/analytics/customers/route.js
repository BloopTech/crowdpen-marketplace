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
    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    const now = new Date();
    const fromDate =
      parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    const replacements = { from: fromDate, to: toDate };

    const uniqueSql = `
      SELECT
        COUNT(DISTINCT o."user_id")::bigint AS "uniqueBuyers",
        COUNT(*)::bigint AS "paidOrders"
      FROM "marketplace_orders" AS o
      WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
    `;

    const repeatSql = `
      SELECT
        COUNT(*)::bigint AS "repeatBuyers"
      FROM (
        SELECT o."user_id"
        FROM "marketplace_orders" AS o
        WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
          AND o."createdAt" >= :from
          AND o."createdAt" <= :to
        GROUP BY o."user_id"
        HAVING COUNT(*) >= 2
      ) t
    `;

    const firstPaidSql = `
      SELECT
        COUNT(*)::bigint AS "firstTimeBuyers"
      FROM (
        SELECT o."user_id", MIN(o."createdAt") AS first_paid_at
        FROM "marketplace_orders" AS o
        WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        GROUP BY o."user_id"
      ) t
      WHERE t.first_paid_at >= :from
        AND t.first_paid_at <= :to
    `;

    const [uniqueAgg] = await db.sequelize.query(uniqueSql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const [repeatAgg] = await db.sequelize.query(repeatSql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const [firstAgg] = await db.sequelize.query(firstPaidSql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const uniqueBuyers = Number(uniqueAgg?.uniqueBuyers || 0) || 0;
    const paidOrders = Number(uniqueAgg?.paidOrders || 0) || 0;
    const repeatBuyers = Number(repeatAgg?.repeatBuyers || 0) || 0;
    const firstTimeBuyers = Number(firstAgg?.firstTimeBuyers || 0) || 0;

    const repeatRate = uniqueBuyers > 0 ? repeatBuyers / uniqueBuyers : 0;
    const ordersPerBuyer = uniqueBuyers > 0 ? paidOrders / uniqueBuyers : 0;

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      data: {
        uniqueBuyers,
        paidOrders,
        repeatBuyers,
        firstTimeBuyers,
        repeatRate,
        ordersPerBuyer,
      },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_analytics_customers_get",
      route: "/api/admin/analytics/customers",
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
