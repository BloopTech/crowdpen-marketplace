import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getMarketplaceFeePercents } from "../../../../lib/marketplaceFees";

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

    const paidAggSql = `
      SELECT
        COUNT(DISTINCT o."id")::bigint AS "paidOrders",
        COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "grossRevenue",
        COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",
        COALESCE(SUM(
          CASE
            WHEN NOT (cu."id" IS NULL OR cu."crowdpen_staff" = true OR cu."role" IN ('admin', 'senior_admin'))
              THEN (ri."discount_amount")::numeric
            ELSE 0
          END
        ), 0) AS "discountMerchantFunded",
        COUNT(DISTINCT p."user_id")::bigint AS "activeMerchants"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"
      LEFT JOIN "marketplace_coupon_redemptions" AS r ON r."id" = ri."redemption_id"
      LEFT JOIN "marketplace_coupons" AS c ON c."id" = r."coupon_id"
      LEFT JOIN "users" AS cu ON cu."id" = c."created_by"
      WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
    `;

    const refundAggSql = `
      SELECT
        COUNT(DISTINCT o."id")::bigint AS "refundedOrders",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "refundRevenue",
        COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "refundDiscountTotal",
        COALESCE(SUM(
          CASE
            WHEN NOT (cu."id" IS NULL OR cu."crowdpen_staff" = true OR cu."role" IN ('admin', 'senior_admin'))
              THEN (ri."discount_amount")::numeric
            ELSE 0
          END
        ), 0) AS "refundDiscountMerchantFunded"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"
      LEFT JOIN "marketplace_coupon_redemptions" AS r ON r."id" = ri."redemption_id"
      LEFT JOIN "marketplace_coupons" AS c ON c."id" = r."coupon_id"
      LEFT JOIN "users" AS cu ON cu."id" = c."created_by"
      WHERE o."paymentStatus" = 'refunded'::"enum_marketplace_orders_paymentStatus"
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
    const discountTotal = Number(paidAgg?.discountTotal || 0) || 0;
    const discountMerchantFunded = Number(paidAgg?.discountMerchantFunded || 0) || 0;
    const activeMerchants = Number(paidAgg?.activeMerchants || 0) || 0;

    const refundedOrders = Number(refundAgg?.refundedOrders || 0) || 0;
    const refundRevenue = Number(refundAgg?.refundRevenue || 0) || 0;
    const refundDiscountTotal = Number(refundAgg?.refundDiscountTotal || 0) || 0;
    const refundDiscountMerchantFunded =
      Number(refundAgg?.refundDiscountMerchantFunded || 0) || 0;

    const netRevenue = Math.max(0, grossRevenue - refundRevenue);
    const netDiscountTotal = Math.max(0, discountTotal - refundDiscountTotal);
    const netDiscountMerchantFunded = Math.max(
      0,
      discountMerchantFunded - refundDiscountMerchantFunded
    );
    const aov = paidOrders > 0 ? grossRevenue / paidOrders : 0;

    const { crowdpenPct: CROWD_PCT, startbuttonPct: SB_PCT } =
      await getMarketplaceFeePercents({ db });

    const buyerPaidGross = Math.max(0, grossRevenue - discountTotal);
    const crowdpenFeeGross = grossRevenue * (CROWD_PCT || 0);
    const startbuttonFeeGross = buyerPaidGross * (SB_PCT || 0);
    const creatorPayoutGross = Math.max(
      0,
      grossRevenue - discountMerchantFunded - crowdpenFeeGross - startbuttonFeeGross
    );

    const buyerPaidNet = Math.max(0, netRevenue - netDiscountTotal);
    const crowdpenFeeNet = netRevenue * (CROWD_PCT || 0);
    const startbuttonFeeNet = buyerPaidNet * (SB_PCT || 0);
    const creatorPayoutNet = Math.max(
      0,
      netRevenue - netDiscountMerchantFunded - crowdpenFeeNet - startbuttonFeeNet
    );

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
        discountTotal,
        discountMerchantFunded,
        buyerPaidGross,
        refundRevenue,
        refundDiscountTotal,
        refundDiscountMerchantFunded,
        refundedOrders,
        netRevenue,
        buyerPaidNet,
        netDiscountTotal,
        netDiscountMerchantFunded,
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
