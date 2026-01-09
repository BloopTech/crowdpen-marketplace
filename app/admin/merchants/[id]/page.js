"use server";
import React from "react";
import { db } from "../../../models/index";
import MerchantRevenueChart from "./MerchantRevenueChart";

function safeIso(v) {
  const d = v ? new Date(v) : null;
  return d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function fmtUsd(v) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v || 0));
}

function fmtDateTimeUtc(v) {
  const d = v ? new Date(v) : null;
  if (!d || !Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("en-US", { timeZone: "UTC" });
}

export default async function AdminMerchantOverviewPage({ params }) {
  const { id } = await params;
  const merchantId = id;
  if (!merchantId) {
    return (
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6">
        <div className="text-lg font-semibold">Missing merchant id</div>
      </div>
    );
  }

  const merchant = await db.User.findOne({
    where: { id: merchantId },
    attributes: ["id", "name", "email", "createdAt", "merchant"],
  });

  if (!merchant) {
    return (
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6">
        <div className="text-lg font-semibold">Merchant not found</div>
      </div>
    );
  }

  const now = new Date();
  const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const lowStockThreshold = 5;

  const productsSql =
    "SELECT\n" +
    '  COUNT(*)::int AS "productsTotal",\n' +
    '  COALESCE(SUM(CASE WHEN p."product_status" = \'published\' THEN 1 ELSE 0 END), 0)::int AS "productsPublished",\n' +
    '  COALESCE(SUM(CASE WHEN p."product_status" = \'archived\' THEN 1 ELSE 0 END), 0)::int AS "productsArchived",\n' +
    '  COALESCE(SUM(CASE WHEN p."flagged" = true THEN 1 ELSE 0 END), 0)::int AS "productsFlagged",\n' +
    '  COALESCE(SUM(CASE WHEN (p."inStock" = false OR (p."stock" IS NOT NULL AND p."stock" <= 0)) THEN 1 ELSE 0 END), 0)::int AS "productsOutOfStock",\n' +
    '  COALESCE(SUM(CASE WHEN (p."stock" IS NOT NULL AND p."stock" > 0 AND p."stock" <= :lowStockThreshold) THEN 1 ELSE 0 END), 0)::int AS "productsLowStock"\n' +
    'FROM "marketplace_products" AS p\n' +
    'WHERE p."user_id" = :merchantId\n';

  const [productAgg] = await db.sequelize.query(productsSql, {
    replacements: { merchantId, lowStockThreshold },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const kycSql =
    'SELECT DISTINCT ON (k."user_id")\n' +
    '  k."status" AS "status",\n' +
    '  k."level" AS "level",\n' +
    '  k."submitted_at" AS "submittedAt",\n' +
    '  k."reviewed_at" AS "reviewedAt"\n' +
    'FROM "marketplace_kyc_verifications" AS k\n' +
    'WHERE k."user_id" = :merchantId\n' +
    'ORDER BY k."user_id", k."updatedAt" DESC NULLS LAST\n';

  const [kycAgg] = await db.sequelize.query(kycSql, {
    replacements: { merchantId },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const salesTotalsSql =
    "SELECT\n" +
    '  COALESCE(SUM(CASE WHEN o."createdAt" >= :from30 THEN (oi."subtotal")::numeric ELSE 0 END), 0) AS "revenue30d",\n' +
    '  COALESCE(SUM(CASE WHEN o."createdAt" >= :from30 THEN (ri."discount_amount")::numeric ELSE 0 END), 0) AS "discountTotal30d",\n' +
    '  COALESCE(SUM(CASE WHEN o."createdAt" >= :from30 THEN oi."quantity" ELSE 0 END), 0) AS "unitsSold30d",\n' +
    '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenueAllTime",\n' +
    '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotalAllTime",\n' +
    '  COALESCE(SUM(oi."quantity"), 0) AS "unitsSoldAllTime",\n' +
    '  MAX(o."createdAt") AS "lastSaleAt"\n' +
    'FROM "marketplace_order_items" AS oi\n' +
    'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n' +
    'JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"\n' +
    'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n' +
    'WHERE o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n' +
    '  AND p."user_id" = :merchantId\n';

  const [salesAgg] = await db.sequelize.query(salesTotalsSql, {
    replacements: { merchantId, from30 },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const revenueDailySql =
    "SELECT\n" +
    "  date_trunc('day', o.\"createdAt\") AS period,\n" +
    '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS revenue,\n' +
    '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",\n' +
    '  COALESCE(SUM(oi."quantity"), 0) AS "unitsSold"\n' +
    'FROM "marketplace_order_items" AS oi\n' +
    'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n' +
    'JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"\n' +
    'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n' +
    'WHERE o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n' +
    '  AND p."user_id" = :merchantId\n' +
    '  AND o."createdAt" >= :from30\n' +
    '  AND o."createdAt" <= :to\n' +
    "GROUP BY 1\n" +
    "ORDER BY 1 ASC\n";

  const revenueDailyRows = await db.sequelize.query(revenueDailySql, {
    replacements: { merchantId, from30, to: now },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const payoutsSql =
    "SELECT\n" +
    '  COALESCE(SUM(CASE WHEN t."status" = \'completed\' THEN t."amount" ELSE 0 END), 0) AS "completedCents",\n' +
    '  COALESCE(SUM(CASE WHEN t."status" = \'pending\' THEN t."amount" ELSE 0 END), 0) AS "pendingCents",\n' +
    '  MAX(CASE WHEN t."status" = \'completed\' THEN t."createdAt" ELSE NULL END) AS "lastPaidAt"\n' +
    'FROM "marketplace_admin_transactions" AS t\n' +
    "WHERE t.\"trans_type\" = 'payout'\n" +
    '  AND t."recipient_id" = :merchantId\n';

  const [payoutAgg] = await db.sequelize.query(payoutsSql, {
    replacements: { merchantId },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const settlementSql =
    "SELECT\n" +
    '  MAX(pp."settlement_to") AS "lastSettlementTo"\n' +
    'FROM "marketplace_payout_periods" AS pp\n' +
    'WHERE pp."is_active" = true\n' +
    '  AND pp."recipient_id" = :merchantId\n';

  const [settlementAgg] = await db.sequelize.query(settlementSql, {
    replacements: { merchantId },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const toMajorCents = (n) => {
    const v = n != null ? Number(n) : NaN;
    if (!Number.isFinite(v)) return 0;
    return v / 100;
  };

  const productsTotal = Number(productAgg?.productsTotal || 0) || 0;
  const productsPublished = Number(productAgg?.productsPublished || 0) || 0;
  const productsFlagged = Number(productAgg?.productsFlagged || 0) || 0;
  const productsOutOfStock = Number(productAgg?.productsOutOfStock || 0) || 0;
  const productsLowStock = Number(productAgg?.productsLowStock || 0) || 0;

  const revenue30dRaw = Number(salesAgg?.revenue30d || 0) || 0;
  const discountTotal30d = Number(salesAgg?.discountTotal30d || 0) || 0;
  const revenue30d = Math.max(0, revenue30dRaw - discountTotal30d);
  const unitsSold30d = Number(salesAgg?.unitsSold30d || 0) || 0;
  const revenueAllTimeRaw = Number(salesAgg?.revenueAllTime || 0) || 0;
  const discountTotalAllTime = Number(salesAgg?.discountTotalAllTime || 0) || 0;
  const revenueAllTime = Math.max(0, revenueAllTimeRaw - discountTotalAllTime);
  const unitsSoldAllTime = Number(salesAgg?.unitsSoldAllTime || 0) || 0;

  const payoutsCompleted = toMajorCents(payoutAgg?.completedCents);
  const payoutsPending = toMajorCents(payoutAgg?.pendingCents);

  const kycStatus = kycAgg?.status ? String(kycAgg.status) : "unverified";
  const kycLevel = kycAgg?.level ? String(kycAgg.level) : null;

  const lastSettlementTo = settlementAgg?.lastSettlementTo
    ? String(settlementAgg.lastSettlementTo)
    : null;

  return (
    <div className="space-y-6 pb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="text-xs text-muted-foreground">KYC</div>
          <div className="text-base font-semibold capitalize">
            {kycStatus}
            {kycLevel ? ` (${kycLevel})` : ""}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Reviewed: {fmtDateTimeUtc(kycAgg?.reviewedAt)}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="text-xs text-muted-foreground">Products</div>
          <div className="text-base font-semibold tabular-nums">
            {productsPublished}/{productsTotal}
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            Flagged: {productsFlagged} • Out: {productsOutOfStock} • Low:{" "}
            {productsLowStock}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="text-xs text-muted-foreground">Buyer Paid (30d)</div>
          <div className="text-base font-semibold tabular-nums">
            {fmtUsd(revenue30d)}
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            Units: {unitsSold30d.toLocaleString("en-US")}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="text-xs text-muted-foreground">Payouts</div>
          <div className="text-base font-semibold tabular-nums">
            {fmtUsd(payoutsCompleted)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Pending: {fmtUsd(payoutsPending)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="text-xs text-muted-foreground">Buyer Paid (All-time)</div>
          <div className="text-base font-semibold tabular-nums">
            {fmtUsd(revenueAllTime)}
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            Units: {unitsSoldAllTime.toLocaleString("en-US")}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="text-xs text-muted-foreground">Last Sale</div>
          <div className="text-base font-semibold">
            {fmtDateTimeUtc(salesAgg?.lastSaleAt)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Merchant since: {fmtDateTimeUtc(merchant.createdAt)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="text-xs text-muted-foreground">Settlement</div>
          <div className="text-base font-semibold">
            {lastSettlementTo || "-"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Last paid: {fmtDateTimeUtc(payoutAgg?.lastPaidAt)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-base font-semibold">
              Revenue (last 30 days)
            </div>
            <div className="text-xs text-muted-foreground">
              Window: {from30.toISOString().slice(0, 10)} →{" "}
              {now.toISOString().slice(0, 10)} (USD)
            </div>
          </div>
        </div>
        <div className="mt-3">
          <MerchantRevenueChart
            rows={(revenueDailyRows || []).map((r) => ({
              period: safeIso(r?.period),
              revenue: Math.max(
                0,
                (Number(r?.revenue || 0) || 0) - (Number(r?.discountTotal || 0) || 0)
              ),
              unitsSold: Number(r?.unitsSold || 0) || 0,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
