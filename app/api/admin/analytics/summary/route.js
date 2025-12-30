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

function parsePct(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/%/g, ""));
  if (!isFinite(n) || isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
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

    const paidAggSql = `
      SELECT
        COUNT(DISTINCT o."id")::bigint AS "paidOrders",
        COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "grossRevenue",
        COUNT(DISTINCT p."user_id")::bigint AS "activeMerchants"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      WHERE LOWER(o."paymentStatus"::text) IN ('successful', 'completed')
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
    `;

    const refundAggSql = `
      SELECT
        COUNT(DISTINCT o."id")::bigint AS "refundedOrders",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "refundRevenue"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      WHERE LOWER(o."paymentStatus"::text) = 'refunded'
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
    `;

    const payoutsSql = `
      SELECT
        LOWER(t."status"::text) AS status,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(t."amount"), 0)::bigint AS amount_cents
      FROM "marketplace_admin_transactions" AS t
      WHERE LOWER(t."trans_type"::text) = 'payout'
        AND t."createdAt" >= :from
        AND t."createdAt" <= :to
      GROUP BY 1
      ORDER BY 1
    `;

    const replacements = { from: fromDate, to: toDate };

    const [paidAgg] = await db.sequelize.query(paidAggSql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const [refundAgg] = await db.sequelize.query(refundAggSql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const payoutRows = await db.sequelize.query(payoutsSql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const paidOrders = Number(paidAgg?.paidOrders || 0) || 0;
    const unitsSold = Number(paidAgg?.unitsSold || 0) || 0;
    const grossRevenue = Number(paidAgg?.grossRevenue || 0) || 0;
    const activeMerchants = Number(paidAgg?.activeMerchants || 0) || 0;

    const refundedOrders = Number(refundAgg?.refundedOrders || 0) || 0;
    const refundRevenue = Number(refundAgg?.refundRevenue || 0) || 0;

    const netRevenue = Math.max(0, grossRevenue - refundRevenue);
    const aov = paidOrders > 0 ? grossRevenue / paidOrders : 0;

    const CROWD_PCT = parsePct(
      process.env.CROWDPEN_FEE_PCT ||
        process.env.CROWD_PEN_FEE_PCT ||
        process.env.PLATFORM_FEE_PCT
    );
    const SB_PCT = parsePct(
      process.env.STARTBUTTON_FEE_PCT ||
        process.env.START_BUTTON_FEE_PCT ||
        process.env.GATEWAY_FEE_PCT
    );

    const crowdpenFeeGross = grossRevenue * (CROWD_PCT || 0);
    const startbuttonFeeGross = grossRevenue * (SB_PCT || 0);
    const creatorPayoutGross = Math.max(0, grossRevenue - crowdpenFeeGross - startbuttonFeeGross);

    const crowdpenFeeNet = netRevenue * (CROWD_PCT || 0);
    const startbuttonFeeNet = netRevenue * (SB_PCT || 0);
    const creatorPayoutNet = Math.max(0, netRevenue - crowdpenFeeNet - startbuttonFeeNet);

    const payouts = {
      completed: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
      refunded: { count: 0, amount: 0 },
      partially_refunded: { count: 0, amount: 0 },
      reversed: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };

    for (const r of payoutRows || []) {
      const key = String(r?.status || "").toLowerCase();
      const bucket = payouts[key] || payouts.other;
      bucket.count += Number(r?.count || 0) || 0;
      bucket.amount += (Number(r?.amount_cents || 0) || 0) / 100;
    }

    const payoutCoverage = creatorPayoutGross > 0
      ? Math.min(1, Math.max(0, (payouts.completed.amount || 0) / creatorPayoutGross))
      : 0;

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      data: {
        paidOrders,
        unitsSold,
        activeMerchants,
        grossRevenue,
        refundRevenue,
        refundedOrders,
        netRevenue,
        aov,
        fees: {
          gross: {
            crowdpenFee: crowdpenFeeGross,
            startbuttonFee: startbuttonFeeGross,
            creatorPayout: creatorPayoutGross,
          },
          net: {
            crowdpenFee: crowdpenFeeNet,
            startbuttonFee: startbuttonFeeNet,
            creatorPayout: creatorPayoutNet,
          },
        },
        payouts,
        payoutCoverage,
      },
    });
  } catch (error) {
    console.error("/api/admin/analytics/summary error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
