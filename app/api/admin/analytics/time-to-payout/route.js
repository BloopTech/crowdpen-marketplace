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
    const limitParam = Number.parseInt(searchParams.get("limit") || "10", 10);

    const now = new Date();
    const fromDate =
      parseDateSafe(fromParam) || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 50)
      : 10;

    const base = `
      WITH rows AS (
        SELECT
          t.recipient_id,
          pa.marketplace_order_id,
          EXTRACT(EPOCH FROM (t."completedAt" - o."updatedAt")) / 3600.0 AS hours
        FROM marketplace_payout_allocations AS pa
        JOIN marketplace_admin_transactions AS t
          ON t.id = pa.marketplace_admin_transaction_id
        JOIN marketplace_orders AS o
          ON o.id = pa.marketplace_order_id
        WHERE LOWER(t.trans_type::text) = 'payout'
          AND LOWER(t.status::text) = 'completed'
          AND t."completedAt" IS NOT NULL
          AND t."completedAt" >= :from
          AND t."completedAt" <= :to
      )
    `;

    const summarySql = `
      ${base}
      SELECT
        COUNT(*)::bigint AS "count",
        COALESCE(AVG(hours), 0)::numeric AS "avgHours",
        COALESCE(MIN(hours), 0)::numeric AS "minHours",
        COALESCE(MAX(hours), 0)::numeric AS "maxHours",
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours), 0)::numeric AS "p50Hours",
        COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY hours), 0)::numeric AS "p90Hours"
      FROM rows
      WHERE hours IS NOT NULL
        AND hours >= 0
    `;

    const byMerchantSql = `
      ${base}
      SELECT
        recipient_id,
        COUNT(*)::bigint AS "count",
        COALESCE(AVG(hours), 0)::numeric AS "avgHours",
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours), 0)::numeric AS "p50Hours",
        COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY hours), 0)::numeric AS "p90Hours"
      FROM rows
      WHERE hours IS NOT NULL
        AND hours >= 0
      GROUP BY 1
      ORDER BY "avgHours" DESC
      LIMIT :limit
    `;

    const replacements = { from: fromDate, to: toDate, limit };

    const [summary] = await db.sequelize.query(summarySql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const byMerchant = await db.sequelize.query(byMerchantSql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      data: {
        summary: summary || {
          count: 0,
          avgHours: 0,
          minHours: 0,
          maxHours: 0,
          p50Hours: 0,
          p90Hours: 0,
        },
        byMerchant: byMerchant || [],
      },
    });
  } catch (error) {
    console.error("/api/admin/analytics/time-to-payout error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
