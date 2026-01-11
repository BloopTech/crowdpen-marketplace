import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
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

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-merchants:list:${userIdForRl}:${ip}`, limit: 120, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get("pageSize") || "20", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = (page - 1) * pageSize;
    const q = (searchParams.get("q") || "").slice(0, 200);
    const requestedApplicantStatus =
      searchParams.get("applicantStatus") || "pending";
    const applicantStatus = ["pending", "rejected"].includes(
      requestedApplicantStatus
    )
      ? requestedApplicantStatus
      : "pending";

    // Merchants (users with merchant=true OR users who have created marketplace products)
    const whereMerchants = {
      [Op.and]: [
        {
          [Op.or]: [
            { merchant: true },
            db.Sequelize.literal(
              'EXISTS (SELECT 1 FROM "marketplace_products" p WHERE p."user_id" = "User"."id")'
            ),
          ],
        },
      ],
    };
    if (q) {
      whereMerchants[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } },
          { pen_name: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }
    const merchantsRes = await db.User.findAndCountAll({
      where: whereMerchants,
      attributes: [
        "id",
        "name",
        "email",
        "pen_name",
        "image",
        "color",
        "role",
        "creator",
        "crowdpen_staff",
        "createdAt",
        "merchant",
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    // applicants (users with KYC submitted; status != 'unverified')
    const applicantUserInclude = {
      model: db.User,
      attributes: ["id", "name", "email", "image", "color", "role"],
    };
    if (q) {
      applicantUserInclude.where = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } },
        ],
      };
      applicantUserInclude.required = true;
    }

    const applicantsRes = await db.MarketplaceKycVerification.findAndCountAll({
      where: { status: applicantStatus },
      include: [applicantUserInclude],
      order: [["submitted_at", "DESC"]],
      limit: pageSize,
      offset,
    });

    const merchants = (merchantsRes.rows || []).map((m) => m.toJSON());
    const merchantIds = merchants.map((m) => m.id).filter(Boolean);

    const now = new Date();
    const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toMajorCents = (n) => {
      const v = n != null ? Number(n) : NaN;
      if (!Number.isFinite(v)) return 0;
      return v / 100;
    };
    const toNumberSafe = (n) => {
      const v = n != null ? Number(n) : NaN;
      return Number.isFinite(v) ? v : 0;
    };
    const toIsoOrNull = (d) => {
      const dt = d ? new Date(d) : null;
      return dt && Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
    };

    const kpiByMerchantId = new Map();
    for (const id of merchantIds) {
      kpiByMerchantId.set(String(id), {
        currency: "USD",
        productsTotal: 0,
        productsPublished: 0,
        productsArchived: 0,
        productsFlagged: 0,
        productsLowStock: 0,
        productsOutOfStock: 0,
        kycStatus: null,
        kycLevel: null,
        kycSubmittedAt: null,
        kycReviewedAt: null,
        revenue30d: 0,
        unitsSold30d: 0,
        revenueAllTime: 0,
        unitsSoldAllTime: 0,
        lastSaleAt: null,
        payoutsCompleted: 0,
        payoutsPending: 0,
        payoutsOwed: 0,
        lastPaidAt: null,
        lastSettlementTo: null,
      });
    }

    if (merchantIds.length > 0) {
      const lowStockThreshold = 5;

      const productsSql =
        'SELECT\n'
        + '  p."user_id" AS "merchantId",\n'
        + '  COUNT(*)::int AS "productsTotal",\n'
        + '  COALESCE(SUM(CASE WHEN p."product_status" = \'published\' THEN 1 ELSE 0 END), 0)::int AS "productsPublished",\n'
        + '  COALESCE(SUM(CASE WHEN p."product_status" = \'archived\' THEN 1 ELSE 0 END), 0)::int AS "productsArchived",\n'
        + '  COALESCE(SUM(CASE WHEN p."flagged" = true THEN 1 ELSE 0 END), 0)::int AS "productsFlagged",\n'
        + '  COALESCE(SUM(CASE WHEN (p."inStock" = false OR (p."stock" IS NOT NULL AND p."stock" <= 0)) THEN 1 ELSE 0 END), 0)::int AS "productsOutOfStock",\n'
        + '  COALESCE(SUM(CASE WHEN (p."stock" IS NOT NULL AND p."stock" > 0 AND p."stock" <= :lowStockThreshold) THEN 1 ELSE 0 END), 0)::int AS "productsLowStock"\n'
        + 'FROM "marketplace_products" AS p\n'
        + 'WHERE p."user_id" IN (:merchantIds)\n'
        + 'GROUP BY 1\n';

      const productRows = await db.sequelize.query(productsSql, {
        replacements: { merchantIds, lowStockThreshold },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      for (const r of productRows || []) {
        const mid = String(r.merchantId);
        const kpi = kpiByMerchantId.get(mid);
        if (!kpi) continue;
        kpi.productsTotal = toNumberSafe(r.productsTotal);
        kpi.productsPublished = toNumberSafe(r.productsPublished);
        kpi.productsArchived = toNumberSafe(r.productsArchived);
        kpi.productsFlagged = toNumberSafe(r.productsFlagged);
        kpi.productsLowStock = toNumberSafe(r.productsLowStock);
        kpi.productsOutOfStock = toNumberSafe(r.productsOutOfStock);
      }

      const kycSql =
        'SELECT DISTINCT ON (k."user_id")\n'
        + '  k."user_id" AS "userId",\n'
        + '  k."status" AS "status",\n'
        + '  k."level" AS "level",\n'
        + '  k."submitted_at" AS "submittedAt",\n'
        + '  k."reviewed_at" AS "reviewedAt"\n'
        + 'FROM "marketplace_kyc_verifications" AS k\n'
        + 'WHERE k."user_id" IN (:merchantIds)\n'
        + 'ORDER BY k."user_id", k."updatedAt" DESC NULLS LAST\n';

      const kycRows = await db.sequelize.query(kycSql, {
        replacements: { merchantIds },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      for (const r of kycRows || []) {
        const mid = String(r.userId);
        const kpi = kpiByMerchantId.get(mid);
        if (!kpi) continue;
        kpi.kycStatus = r.status ? String(r.status) : null;
        kpi.kycLevel = r.level ? String(r.level) : null;
        kpi.kycSubmittedAt = toIsoOrNull(r.submittedAt);
        kpi.kycReviewedAt = toIsoOrNull(r.reviewedAt);
      }

      const salesSql =
        'SELECT\n'
        + '  p."user_id" AS "merchantId",\n'
        + '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue30d",\n'
        + '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal30d",\n'
        + '  COALESCE(SUM(oi."quantity"), 0) AS "unitsSold30d",\n'
        + '  MAX(o."createdAt") AS "lastSaleAt"\n'
        + 'FROM "marketplace_order_items" AS oi\n'
        + 'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n'
        + 'JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"\n'
        + 'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n'
        + 'WHERE o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n'
        + '  AND p."user_id" IN (:merchantIds)\n'
        + '  AND o."createdAt" >= :from30\n'
        + 'GROUP BY 1\n';

      const salesRows = await db.sequelize.query(salesSql, {
        replacements: { merchantIds, from30 },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      for (const r of salesRows || []) {
        const mid = String(r.merchantId);
        const kpi = kpiByMerchantId.get(mid);
        if (!kpi) continue;
        const revenue30d = toNumberSafe(r.revenue30d);
        const discountTotal30d = toNumberSafe(r.discountTotal30d);
        kpi.revenue30d = Math.max(0, revenue30d - discountTotal30d);
        kpi.unitsSold30d = toNumberSafe(r.unitsSold30d);
        kpi.lastSaleAt = toIsoOrNull(r.lastSaleAt);
      }

      const salesAllTimeSql =
        'SELECT\n'
        + '  p."user_id" AS "merchantId",\n'
        + '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenueAllTime",\n'
        + '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotalAllTime",\n'
        + '  COALESCE(SUM(oi."quantity"), 0) AS "unitsSoldAllTime"\n'
        + 'FROM "marketplace_order_items" AS oi\n'
        + 'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n'
        + 'JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"\n'
        + 'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n'
        + 'WHERE o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n'
        + '  AND p."user_id" IN (:merchantIds)\n'
        + 'GROUP BY 1\n';

      const salesAllTimeRows = await db.sequelize.query(salesAllTimeSql, {
        replacements: { merchantIds },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      for (const r of salesAllTimeRows || []) {
        const mid = String(r.merchantId);
        const kpi = kpiByMerchantId.get(mid);
        if (!kpi) continue;
        const revenueAllTime = toNumberSafe(r.revenueAllTime);
        const discountTotalAllTime = toNumberSafe(r.discountTotalAllTime);
        kpi.revenueAllTime = Math.max(0, revenueAllTime - discountTotalAllTime);
        kpi.unitsSoldAllTime = toNumberSafe(r.unitsSoldAllTime);
      }

      const ledgerCreditsSql =
        'SELECT\n'
        + '  e.recipient_id AS "merchantId",\n'
        + '  COALESCE(SUM(e.amount_cents), 0)::bigint AS "creditsCents"\n'
        + 'FROM public.marketplace_earnings_ledger_entries e\n'
        + 'WHERE e.entry_type = \'sale_credit\'\n'
        + '  AND e.recipient_id IN (:merchantIds)\n'
        + 'GROUP BY 1\n';

      const ledgerCreditsRows = await db.sequelize.query(ledgerCreditsSql, {
        replacements: { merchantIds },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      const payoutAggSql =
        'WITH tx AS (\n'
        + '  SELECT t.id, t.recipient_id, t.amount, t.status, t."createdAt"\n'
        + '  FROM public.marketplace_admin_transactions t\n'
        + '  WHERE t.trans_type = \'payout\'\n'
        + '    AND t.recipient_id IN (:merchantIds)\n'
        + '), led AS (\n'
        + '  SELECT\n'
        + '    le.marketplace_admin_transaction_id AS tx_id,\n'
        + '    COUNT(le.id)::bigint AS ledger_rows,\n'
        + '    COALESCE(SUM(le.amount_cents), 0)::bigint AS ledger_sum_cents\n'
        + '  FROM public.marketplace_earnings_ledger_entries le\n'
        + '  WHERE le.entry_type IN (\'payout_debit\',\'payout_debit_reversal\')\n'
        + '  GROUP BY 1\n'
        + '), per_tx AS (\n'
        + '  SELECT\n'
        + '    tx.recipient_id AS merchant_id,\n'
        + '    tx.status,\n'
        + '    CASE\n'
        + '      WHEN COALESCE(led.ledger_rows, 0) > 0 THEN GREATEST(0, -led.ledger_sum_cents)\n'
        + '      ELSE COALESCE(tx.amount, 0)\n'
        + '    END::bigint AS paid_cents,\n'
        + '    CASE WHEN tx.status = \'completed\' THEN tx."createdAt" ELSE NULL END AS paid_at\n'
        + '  FROM tx\n'
        + '  LEFT JOIN led ON led.tx_id = tx.id\n'
        + ')\n'
        + 'SELECT\n'
        + '  merchant_id AS "merchantId",\n'
        + '  COALESCE(SUM(CASE WHEN status = \'completed\' THEN paid_cents ELSE 0 END), 0)::bigint AS "completedCents",\n'
        + '  COALESCE(SUM(CASE WHEN status = \'pending\' THEN paid_cents ELSE 0 END), 0)::bigint AS "pendingCents",\n'
        + '  MAX(paid_at) AS "lastPaidAt"\n'
        + 'FROM per_tx\n'
        + 'GROUP BY 1\n';

      const payoutAggRows = await db.sequelize.query(payoutAggSql, {
        replacements: { merchantIds },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      for (const r of payoutAggRows || []) {
        const mid = String(r.merchantId);
        const kpi = kpiByMerchantId.get(mid);
        if (!kpi) continue;
        kpi.payoutsCompleted = toMajorCents(r.completedCents);
        kpi.payoutsPending = toMajorCents(r.pendingCents);
        kpi.lastPaidAt = toIsoOrNull(r.lastPaidAt);
      }

      for (const r of ledgerCreditsRows || []) {
        const mid = String(r.merchantId);
        const kpi = kpiByMerchantId.get(mid);
        if (!kpi) continue;

        const earnedAllTime = (Number(r.creditsCents || 0) || 0) / 100;
        const completed = Number(kpi.payoutsCompleted || 0) || 0;
        const inFlight = Number(kpi.payoutsPending || 0) || 0;
        const owed = earnedAllTime - completed - inFlight;
        kpi.payoutsOwed = Number.isFinite(owed) ? Math.max(0, Number(owed.toFixed(2))) : 0;
      }

      const settlementSql =
        'SELECT\n'
        + '  pp."recipient_id" AS "merchantId",\n'
        + '  MAX(pp."settlement_to") AS "lastSettlementTo"\n'
        + 'FROM "marketplace_payout_periods" AS pp\n'
        + 'WHERE pp."is_active" = true\n'
        + '  AND pp."recipient_id" IN (:merchantIds)\n'
        + 'GROUP BY 1\n';

      const settlementRows = await db.sequelize.query(settlementSql, {
        replacements: { merchantIds },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      for (const r of settlementRows || []) {
        const mid = String(r.merchantId);
        const kpi = kpiByMerchantId.get(mid);
        if (!kpi) continue;
        kpi.lastSettlementTo = r.lastSettlementTo ? String(r.lastSettlementTo) : null;
      }
    }

    const merchantsWithKpis = merchants.map((m) => ({
      ...m,
      kpi: kpiByMerchantId.get(String(m.id)) || null,
    }));

    return NextResponse.json({
      status: "success",
      page,
      pageSize,
      merchants: merchantsWithKpis,
      merchantsTotal: merchantsRes.count,
      applicants: applicantsRes.rows,
      applicantsTotal: applicantsRes.count,
      applicantsStatus: applicantStatus,
      metrics: {
        currency: "USD",
        salesWindowDays: 30,
        salesFrom: from30.toISOString(),
        salesTo: now.toISOString(),
      },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_merchants_list",
      route: "/api/admin/merchants",
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
