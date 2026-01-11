import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { validate as isUUID } from "uuid";
import { getMarketplaceFeePercents } from "../../../../lib/marketplaceFees";
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
    const intervalRaw = String(searchParams.get("interval") || "day").toLowerCase();
    const interval = ["day", "week", "month"].includes(intervalRaw)
      ? intervalRaw
      : "day";

    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);
    const merchantIdRaw = String(searchParams.get("merchantId") || "").trim().slice(0, 128);
    const productIdRaw = String(searchParams.get("productId") || "").trim().slice(0, 128);
    const merchantId = merchantIdRaw && isUUID(merchantIdRaw) ? merchantIdRaw : null;
    const productId = productIdRaw && isUUID(productIdRaw) ? productIdRaw : null;

    const now = new Date();
    const fromDate = parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    const whereParts = [
      `o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"`,
      `o."createdAt" >= :from`,
      `o."createdAt" <= :to`,
    ];

    const replacements = {
      from: fromDate,
      to: toDate,
      interval,
    };

    if (merchantId) {
      whereParts.push(`p."user_id" = :merchantId`);
      replacements.merchantId = merchantId;
    }

    if (productId) {
      whereParts.push(`oi."marketplace_product_id" = :productId`);
      replacements.productId = productId;
    }

    const whereSql = whereParts.join(" AND ");
    const sql =
      'SELECT\n'
      + '  date_trunc(:interval, o."createdAt") AS period,\n'
      + '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS revenue,\n'
      + '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",\n'
      + '  COALESCE(SUM(\n'
      + '    CASE\n'
      + '      WHEN NOT (cu."id" IS NULL OR cu."crowdpen_staff" = true OR cu."role" IN (\'admin\', \'senior_admin\'))\n'
      + '        THEN (ri."discount_amount")::numeric\n'
      + '      ELSE 0\n'
      + '    END\n'
      + '  ), 0) AS "discountMerchantFunded",\n'
      + '  COALESCE(SUM(oi."quantity"), 0) AS "unitsSold"\n'
      + 'FROM "marketplace_order_items" AS oi\n'
      + 'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n'
      + 'JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"\n'
      + 'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n'
      + 'LEFT JOIN "marketplace_coupon_redemptions" AS r ON r."id" = ri."redemption_id"\n'
      + 'LEFT JOIN "marketplace_coupons" AS c ON c."id" = r."coupon_id"\n'
      + 'LEFT JOIN "users" AS cu ON cu."id" = c."created_by"\n'
      + 'WHERE ' + whereSql + '\n'
      + 'GROUP BY 1\n'
      + 'ORDER BY 1 ASC\n';

    const rows = await db.sequelize.query(sql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const ledgerRows = await db.sequelize.query(
      `
        SELECT
          date_trunc(:interval, e.earned_at) AS period,
          COALESCE(SUM(e.amount_cents), 0)::bigint AS "creditsCents"
        FROM public.marketplace_earnings_ledger_entries e
        LEFT JOIN public.marketplace_order_items oi
          ON oi.id = e.marketplace_order_item_id
        WHERE e.entry_type = 'sale_credit'
          AND e.earned_at >= :from
          AND e.earned_at <= :to
          AND (:merchantId::uuid IS NULL OR e.recipient_id = :merchantId::uuid)
          AND (:productId::uuid IS NULL OR oi.marketplace_product_id = :productId::uuid)
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      {
        replacements,
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const creditsCentsByPeriod = new Map(
      (ledgerRows || []).map((r) => {
        const d = r?.period ? new Date(r.period) : null;
        const key = d && Number.isFinite(d.getTime()) ? d.toISOString() : String(r?.period || "");
        return [key, Number(r?.creditsCents || 0) || 0];
      })
    );
    const hasAnyLedgerCredits = creditsCentsByPeriod.size > 0;

    const { crowdpenPct: CROWD_PCT, startbuttonPct: SB_PCT } =
      await getMarketplaceFeePercents({ db });

    let totalsRevenue = 0;
    let totalsUnitsSold = 0;

    const data = (rows || []).map((r) => {
      const revenue = Number(r?.revenue || 0) || 0;
      const discountTotal = Number(r?.discountTotal || 0) || 0;
      const discountMerchantFunded = Number(r?.discountMerchantFunded || 0) || 0;
      const buyerPaid = Math.max(0, revenue - discountTotal);
      const unitsSold = Number(r?.unitsSold || 0) || 0;
      const crowdpenFee = revenue * (CROWD_PCT || 0);
      const startbuttonFee = buyerPaid * (SB_PCT || 0);
      const d = r?.period ? new Date(r.period) : null;
      const periodKey = d && Number.isFinite(d.getTime()) ? d.toISOString() : String(r?.period || "");
      const creditsCents = creditsCentsByPeriod.get(periodKey);
      const creatorPayout = hasAnyLedgerCredits && Number.isFinite(creditsCents)
        ? Math.max(0, creditsCents / 100)
        : Math.max(
            0,
            revenue - discountMerchantFunded - crowdpenFee - startbuttonFee
          );

      totalsRevenue += revenue;
      totalsUnitsSold += unitsSold;

      return {
        period: d && Number.isFinite(d.getTime()) ? d.toISOString() : String(r?.period || ""),
        revenue,
        discountTotal,
        discountMerchantFunded,
        buyerPaid,
        unitsSold,
        crowdpenFee,
        startbuttonFee,
        creatorPayout,
      };
    });

    const totals = {
      revenue: totalsRevenue,
      buyerPaid: null,
      unitsSold: totalsUnitsSold,
      crowdpenFee: totalsRevenue * (CROWD_PCT || 0),
      startbuttonFee: null,
      creatorPayout: null,
    };

    const totalsDiscountTotal = (rows || []).reduce(
      (acc, r) => acc + (Number(r?.discountTotal || 0) || 0),
      0
    );
    const totalsDiscountMerchantFunded = (rows || []).reduce(
      (acc, r) => acc + (Number(r?.discountMerchantFunded || 0) || 0),
      0
    );
    const totalsBuyerPaid = Math.max(0, totalsRevenue - totalsDiscountTotal);
    totals.buyerPaid = totalsBuyerPaid;
    totals.discountTotal = totalsDiscountTotal;
    totals.discountMerchantFunded = totalsDiscountMerchantFunded;
    totals.startbuttonFee = totalsBuyerPaid * (SB_PCT || 0);
    totals.creatorPayout = Math.max(
      0,
      totalsRevenue - totalsDiscountMerchantFunded - totals.crowdpenFee - totals.startbuttonFee
    );

    if (hasAnyLedgerCredits) {
      const totalCreditsCents = (ledgerRows || []).reduce(
        (acc, r) => acc + (Number(r?.creditsCents || 0) || 0),
        0
      );
      totals.creatorPayout = Math.max(0, totalCreditsCents / 100);
    }

    return NextResponse.json({
      status: "success",
      interval,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      filters: { merchantId, productId },
      totals,
      data,
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_analytics_revenue_get",
      route: "/api/admin/analytics/revenue",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed" : (error?.message || "Failed"),
      },
      { status: 500 }
    );
  }
}
