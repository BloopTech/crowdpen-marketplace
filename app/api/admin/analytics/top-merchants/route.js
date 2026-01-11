import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
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

function parseDateEndUtc(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999));
    if (!Number.isFinite(dt.getTime())) return null;
    return dt;
  }
  return parseDateSafe(s);
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
    const merchantId = String(
      searchParams.get("merchantId") || searchParams.get("merchant_id") || ""
    )
      .slice(0, 120)
      .trim();
    const limitParam = Number.parseInt(searchParams.get("limit") || "10", 10);
    const limit = merchantId
      ? 1
      : Number.isFinite(limitParam)
        ? Math.min(Math.max(limitParam, 1), 100)
        : 10;

    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    const now = new Date();
    const fromDate = parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateEndUtc(toParam) || now;

    const replacements = merchantId
      ? { from: fromDate, to: toDate, limit, merchantId }
      : { from: fromDate, to: toDate, limit };

    const sql = `
      SELECT
        u."id" AS "id",
        u."pen_name" AS "penName",
        u."name" AS "name",
        u."email" AS "email",
        COUNT(DISTINCT o."id")::bigint AS "orderCount",
        COUNT(DISTINCT p."id")::bigint AS "productsSoldCount",
        COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      JOIN "users" AS u ON u."id" = p."user_id"
      WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
        ${merchantId ? 'AND u."id" = :merchantId' : ""}
      GROUP BY u."id"
      ORDER BY "revenue" DESC
      LIMIT :limit
    `;

    const rows = await db.sequelize.query(sql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const discountSql = `
      SELECT
        p."user_id" AS "merchantId",
        COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",
        COALESCE(SUM(
          CASE
            WHEN (cu."id" IS NULL OR cu."crowdpen_staff" = true OR cu."role" IN ('admin', 'senior_admin'))
              THEN (ri."discount_amount")::numeric
            ELSE 0
          END
        ), 0) AS "discountCrowdpenFunded",
        COALESCE(SUM(
          CASE
            WHEN NOT (cu."id" IS NULL OR cu."crowdpen_staff" = true OR cu."role" IN ('admin', 'senior_admin'))
              THEN (ri."discount_amount")::numeric
            ELSE 0
          END
        ), 0) AS "discountMerchantFunded"
      FROM "marketplace_coupon_redemption_items" AS ri
      JOIN "marketplace_coupon_redemptions" AS r ON r."id" = ri."redemption_id"
      JOIN "marketplace_coupons" AS c ON c."id" = r."coupon_id"
      LEFT JOIN "users" AS cu ON cu."id" = c."created_by"
      JOIN "marketplace_order_items" AS oi ON oi."id" = ri."order_item_id"
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
        ${merchantId ? 'AND p."user_id" = :merchantId' : ""}
      GROUP BY 1
    `;

    const discountRows = await db.sequelize.query(discountSql, {
      replacements: merchantId
        ? { from: fromDate, to: toDate, merchantId }
        : { from: fromDate, to: toDate },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const discountByMerchantId = new Map(
      (discountRows || []).map((r) => [String(r?.merchantId || ""), r])
    );

    const merchantIds = (rows || []).map((r) => r?.id).filter(Boolean);
    const ledgerRows = merchantIds.length
      ? await db.sequelize.query(
          `
            SELECT
              e.recipient_id AS "merchantId",
              COALESCE(SUM(e.amount_cents), 0)::bigint AS "creditsCents"
            FROM public.marketplace_earnings_ledger_entries e
            WHERE e.entry_type = 'sale_credit'
              AND e.earned_at >= :from
              AND e.earned_at <= :to
              AND e.recipient_id IN (:merchantIds)
            GROUP BY 1
          `,
          {
            replacements: {
              from: fromDate,
              to: toDate,
              merchantIds,
            },
            type: db.Sequelize.QueryTypes.SELECT,
          }
        )
      : [];
    const creditsByMerchantId = new Map(
      (ledgerRows || []).map((r) => [String(r?.merchantId || ""), r])
    );

    const { crowdpenPct: CROWD_PCT, startbuttonPct: SB_PCT } =
      await getMarketplaceFeePercents({ db });

    const data = (rows || []).map((r) => {
      const revenue = Number(r?.revenue || 0) || 0;
      const crowdpenFee = revenue * (CROWD_PCT || 0);

      const dRow = discountByMerchantId.get(String(r?.id || "")) || null;
      const discountTotal = Number(dRow?.discountTotal || 0) || 0;
      const discountCrowdpenFunded = Number(dRow?.discountCrowdpenFunded || 0) || 0;
      const discountMerchantFunded = Number(dRow?.discountMerchantFunded || 0) || 0;
      const buyerPaid = Math.max(0, revenue - discountTotal);
      const startbuttonFee = buyerPaid * (SB_PCT || 0);
      const crowdpenNetAfterDiscount = Math.max(
        0,
        crowdpenFee - discountCrowdpenFunded
      );

      const merchantKey = String(r?.id || "");
      const hasLedgerCredits = creditsByMerchantId.has(merchantKey);
      const creditsCents = hasLedgerCredits
        ? Number(creditsByMerchantId.get(merchantKey)?.creditsCents || 0)
        : null;
      const creatorPayout = hasLedgerCredits && Number.isFinite(creditsCents)
        ? Math.max(0, creditsCents / 100)
        : Math.max(0, revenue - discountMerchantFunded - crowdpenFee - startbuttonFee);

      return {
        id: r?.id,
        merchantId: r?.id,
        penName: r?.penName || null,
        name: r?.name || null,
        email: r?.email || null,
        orderCount: Number(r?.orderCount || 0) || 0,
        productsSoldCount: Number(r?.productsSoldCount || 0) || 0,
        unitsSold: Number(r?.unitsSold || 0) || 0,
        revenue,
        crowdpenFee,
        crowdpenNetAfterDiscount,
        startbuttonFee,
        creatorPayout,
        discountTotal,
        discountCrowdpenFunded,
        discountMerchantFunded,
      };
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      limit,
      fees: {
        crowdpenPct: CROWD_PCT || 0,
        startbuttonPct: SB_PCT || 0,
      },
      data,
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_analytics_top_merchants_get",
      route: "/api/admin/analytics/top-merchants",
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
