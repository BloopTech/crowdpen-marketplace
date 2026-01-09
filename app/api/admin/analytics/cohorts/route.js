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
    const cohortParam = (searchParams.get("cohort") || "week").toLowerCase();
    const cohort = ["day", "week", "month"].includes(cohortParam)
      ? cohortParam
      : "week";

    const lookbackDaysParam = Number.parseInt(searchParams.get("lookbackDays") || "90", 10);
    const lookbackDays = Number.isFinite(lookbackDaysParam)
      ? Math.min(Math.max(lookbackDaysParam, 7), 365)
      : 90;

    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    const now = new Date();
    const fromDate =
      parseDateSafe(fromParam) ||
      new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    // Cohort definition: each buyer joins the cohort on their first paid order in the window.
    // Retention: if they place another paid order within +7/+14/+28 days from that first paid order.
    const sql = `
      WITH paid_orders AS (
        SELECT
          o."user_id" AS user_id,
          o."createdAt" AS created_at
        FROM "marketplace_orders" AS o
        WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
          AND o."createdAt" >= :from
          AND o."createdAt" <= :to
      ),
      cohort_base AS (
        SELECT
          user_id,
          MIN(created_at) AS first_paid_at
        FROM paid_orders
        GROUP BY 1
      ),
      labeled AS (
        SELECT
          cb.user_id,
          cb.first_paid_at,
          date_trunc(:cohort, cb.first_paid_at) AS cohort_period
        FROM cohort_base cb
      ),
      flags AS (
        SELECT
          l.cohort_period,
          COUNT(*)::bigint AS cohort_size,
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM paid_orders po
              WHERE po.user_id = l.user_id
                AND po.created_at > l.first_paid_at
                AND po.created_at <= l.first_paid_at + interval '7 days'
            )
          )::bigint AS retained_w1,
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM paid_orders po
              WHERE po.user_id = l.user_id
                AND po.created_at > l.first_paid_at
                AND po.created_at <= l.first_paid_at + interval '14 days'
            )
          )::bigint AS retained_w2,
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM paid_orders po
              WHERE po.user_id = l.user_id
                AND po.created_at > l.first_paid_at
                AND po.created_at <= l.first_paid_at + interval '28 days'
            )
          )::bigint AS retained_w4
        FROM labeled l
        GROUP BY 1
      )
      SELECT
        cohort_period,
        cohort_size,
        retained_w1,
        retained_w2,
        retained_w4
      FROM flags
      ORDER BY cohort_period ASC
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { from: fromDate, to: toDate, cohort },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const data = (rows || []).map((r) => {
      const cohortSize = Number(r?.cohort_size || 0) || 0;
      const w1 = Number(r?.retained_w1 || 0) || 0;
      const w2 = Number(r?.retained_w2 || 0) || 0;
      const w4 = Number(r?.retained_w4 || 0) || 0;
      const d = r?.cohort_period ? new Date(r.cohort_period) : null;

      return {
        cohortPeriod: d && Number.isFinite(d.getTime()) ? d.toISOString() : String(r?.cohort_period || ""),
        cohortSize,
        retainedW1: w1,
        retainedW2: w2,
        retainedW4: w4,
        retainedRateW1: cohortSize > 0 ? w1 / cohortSize : 0,
        retainedRateW2: cohortSize > 0 ? w2 / cohortSize : 0,
        retainedRateW4: cohortSize > 0 ? w4 / cohortSize : 0,
      };
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      cohort,
      lookbackDays,
      data,
    });
  } catch (error) {
    console.error("/api/admin/analytics/cohorts error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
