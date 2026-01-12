import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

function isOrderSuccessful(order) {
  const payment = (order?.paymentStatus || "").toString().toLowerCase();
  const status = (order?.orderStatus || "").toString().toLowerCase();
  return payment === "successful" || status === "successful";
}

function isOrderBlocked(order) {
  const payment = (order?.paymentStatus || "").toString().toLowerCase();
  const status = (order?.orderStatus || "").toString().toLowerCase();
  return (
    payment === "failed" ||
    payment === "refunded" ||
    status === "failed" ||
    status === "cancelled"
  );
}

function getOrderCollectionStage(order) {
  if (!order) return null;
  if (isOrderSuccessful(order)) return "completed";
  const provider = (order?.payment_provider || "").toString().trim().toLowerCase();
  if (provider !== "startbutton") return null;
  const notes = (order?.notes || "").toString();
  if (!notes) return null;
  const matches = Array.from(notes.matchAll(/\bstage=([a-zA-Z_]+)\b/g));
  const last = matches.length ? matches[matches.length - 1] : null;
  const stage = last?.[1] ? String(last[1]).trim().toLowerCase() : "";
  return stage || null;
}

// GET /api/marketplace/account
// Returns current user's profile and purchases
export async function GET(request) {
  let session;
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  try {
    session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user profile
    const user = await db.User.findOne({
      where: { id: userId },
      attributes: [
        "id",
        "name",
        "email",
        "image",
        "description",
        "pen_name",
        "role",
        "crowdpen_staff",
        "merchant",
        "createdAt",
      ],
    });

    // Safely split name into first/last
    const fullName = user?.name || "";
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ").trim();

    const profile = {
      id: user?.id,
      name: fullName || undefined,
      firstName: firstName || session.user.name?.split(" ")?.[0] || "",
      lastName:
        lastName || session.user.name?.split(" ")?.slice(1).join(" ") || "",
      email: user?.email || session.user.email || "",
      bio: user?.description || "",
      image: user?.image || null,
      pen_name: user?.pen_name || null,
      role: user?.role || null,
      crowdpen_staff: user?.crowdpen_staff === true,
      merchant: user?.merchant === true,
      memberSince: user?.createdAt || null,
      settings: {
        newProductNotifications: true,
        weeklyNewsletter: true,
        marketingEmails: false,
        publicPurchases: true,
        publicWishlist: false,
        ...(user?.settings || {}),
      },
    };

    // Fetch purchases: orders + order items + products + product authors
    const orders = await db.MarketplaceOrder.findAll({
      where: {
        user_id: userId,
        [Op.or]: [
          { paymentStatus: "successful" },
          { orderStatus: "successful" },
          { orderStatus: "processing", paymentStatus: "successful" },
          {
            orderStatus: "processing",
            paymentStatus: "pending",
            payment_provider: "startbutton",
            notes: { [Op.iLike]: "%stage=verified%" },
          },
        ],
      },
      include: [
        {
          model: db.MarketplaceOrderItems,
          include: [
            {
              model: db.MarketplaceProduct,
              include: [
                {
                  model: db.User,
                  attributes: ["id", "name", "email"],
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Flatten to a list of purchase entries
    const purchases = [];
    for (const order of orders) {
      const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
      const purchaseDate = createdAt
        ? createdAt.toISOString().slice(0, 10)
        : null;

      const paymentStage = getOrderCollectionStage(order);
      const status =
        paymentStage === "verified"
          ? "verified"
          : order.paymentStatus || order.orderStatus || "processing";

      const maxVerifiedDownloadsRaw = process.env.STARTBUTTON_VERIFIED_DOWNLOAD_LIMIT;
      const maxVerifiedDownloads = Number.isFinite(Number(maxVerifiedDownloadsRaw))
        ? Math.max(0, Math.floor(Number(maxVerifiedDownloadsRaw)))
        : 3;

      const orderCurrency = "USD";
      const orderSubtotal = order?.subtotal != null ? Number(order.subtotal) : null;
      const orderTotal = order?.total != null ? Number(order.total) : null;

      for (const item of order.MarketplaceOrderItems || []) {
        const product = item.MarketplaceProduct;
        const authorUser = product?.User;
        const downloadUrl =
          item?.downloadUrl != null ? String(item.downloadUrl).trim() : "";
        const productFile =
          product?.file != null ? String(product.file).trim() : "";
        const revoked = downloadUrl.toUpperCase() === "REVOKED";
        const hasFile = Boolean(downloadUrl) || Boolean(productFile);
        const downloadCount = item?.downloadCount != null ? Number(item.downloadCount) : 0;
        const allowVerifiedDownload = paymentStage === "verified";
        const blocked = isOrderBlocked(order);

        const canDownload =
          !blocked &&
          !revoked &&
          hasFile &&
          (isOrderSuccessful(order) ||
            (allowVerifiedDownload &&
              maxVerifiedDownloads > 0 &&
              Number.isFinite(downloadCount) &&
              downloadCount < maxVerifiedDownloads));
        purchases.push({
          id: item.id,
          orderId: order.id,
          orderNumber: order.order_number,
          title: item.name || product?.title,
          author: authorUser?.pen_name || authorUser?.name || "Unknown Author",
          purchaseDate,
          price: orderTotal,
          subtotal: orderSubtotal,
          currency: orderCurrency,
          status,
          paymentStage,
          canDownload,
        });
      }
    }

    // Fetch KYC status for user (if any)
    const kycRecord = db?.MarketplaceKycVerification
      ? await db.MarketplaceKycVerification.findOne({
          where: { user_id: userId },
        })
      : null;
    const kyc = kycRecord
      ? {
          id: kycRecord.id,
          status: kycRecord.status,
          level: kycRecord.level,
          first_name: kycRecord.first_name,
          last_name: kycRecord.last_name,
          middle_name: kycRecord.middle_name,
          phone_number: kycRecord.phone_number,
          dob: kycRecord.dob,
          nationality: kycRecord.nationality,
          address_line1: kycRecord.address_line1,
          address_line2: kycRecord.address_line2,
          city: kycRecord.city,
          state: kycRecord.state,
          postal_code: kycRecord.postal_code,
          country: kycRecord.country,
          id_type: kycRecord.id_type,
          id_number: kycRecord.id_number,
          id_country: kycRecord.id_country,
          id_expiry: kycRecord.id_expiry,
          id_front_url: kycRecord.id_front_url,
          id_back_url: kycRecord.id_back_url,
          selfie_url: kycRecord.selfie_url,
          rejection_reason: kycRecord.rejection_reason,
          reviewed_by: kycRecord.reviewed_by,
          reviewed_at: kycRecord.reviewed_at,
          submitted_at: kycRecord.submitted_at,
          provider: kycRecord.provider,
          metadata: kycRecord.metadata,
        }
      : null;

    // Fetch merchant bank details (masked)
    const bankRecord = db?.MarketplaceMerchantBank
      ? await db.MarketplaceMerchantBank.findOne({ where: { user_id: userId } })
      : null;
    const bank = bankRecord
      ? {
          id: bankRecord.id,
          payout_type: bankRecord.payout_type,
          currency: bankRecord.currency,
          country_code: bankRecord.country_code,
          bank_code: bankRecord.bank_code,
          bank_name: bankRecord.bank_name,
          bank_id: bankRecord.bank_id,
          account_name: bankRecord.account_name,
          account_number_last4: bankRecord.account_number_last4,
          verified: !!bankRecord.verified,
        }
      : null;

    // Merchant payouts + earnings (seller-side)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

    let lastSettledTo = null;
    try {
      const [settledRow] = await db.sequelize.query(
        `
          SELECT MAX(settlement_to) AS "lastSettledTo"
          FROM public.marketplace_payout_periods
          WHERE recipient_id = :merchantId
            AND is_active = TRUE
        `,
        {
          replacements: { merchantId: userId },
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );
      if (settledRow?.lastSettledTo) {
        const dt = new Date(settledRow.lastSettledTo);
        lastSettledTo = Number.isFinite(dt.getTime()) ? dt : null;
      }
    } catch (e) {
      const code = e?.original?.code || e?.code;
      if (code !== "42P01") throw e;
    }

    let settledCreditsCents = 0;
    let pendingCreditsCents = 0;
    let monthSettledCreditsCents = 0;
    let lastMonthSettledCreditsCents = 0;

    if (lastSettledTo) {
      const [settledRow, pendingRow, monthRow, lastMonthRow] = await Promise.all([
        db.sequelize.query(
          `
            SELECT COALESCE(SUM(e.amount_cents), 0)::bigint AS "cents"
            FROM public.marketplace_earnings_ledger_entries e
            WHERE e.recipient_id = :merchantId
              AND e.entry_type = 'sale_credit'
              AND e.earned_at::date <= :settledTo::date
          `,
          {
            replacements: { merchantId: userId, settledTo: lastSettledTo },
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
        db.sequelize.query(
          `
            SELECT COALESCE(SUM(e.amount_cents), 0)::bigint AS "cents"
            FROM public.marketplace_earnings_ledger_entries e
            WHERE e.recipient_id = :merchantId
              AND e.entry_type = 'sale_credit'
              AND e.earned_at::date > :settledTo::date
          `,
          {
            replacements: { merchantId: userId, settledTo: lastSettledTo },
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
        db.sequelize.query(
          `
            SELECT COALESCE(SUM(e.amount_cents), 0)::bigint AS "cents"
            FROM public.marketplace_earnings_ledger_entries e
            WHERE e.recipient_id = :merchantId
              AND e.entry_type = 'sale_credit'
              AND e.earned_at >= :from
              AND e.earned_at <= :to
              AND e.earned_at::date <= :settledTo::date
          `,
          {
            replacements: {
              merchantId: userId,
              settledTo: lastSettledTo,
              from: monthStart,
              to: now,
            },
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
        db.sequelize.query(
          `
            SELECT COALESCE(SUM(e.amount_cents), 0)::bigint AS "cents"
            FROM public.marketplace_earnings_ledger_entries e
            WHERE e.recipient_id = :merchantId
              AND e.entry_type = 'sale_credit'
              AND e.earned_at >= :from
              AND e.earned_at <= :to
              AND e.earned_at::date <= :settledTo::date
          `,
          {
            replacements: {
              merchantId: userId,
              settledTo: lastSettledTo,
              from: lastMonthStart,
              to: lastMonthEnd,
            },
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
      ]);

      settledCreditsCents = Number(settledRow?.[0]?.cents || 0) || 0;
      pendingCreditsCents = Number(pendingRow?.[0]?.cents || 0) || 0;
      monthSettledCreditsCents = Number(monthRow?.[0]?.cents || 0) || 0;
      lastMonthSettledCreditsCents = Number(lastMonthRow?.[0]?.cents || 0) || 0;
    } else {
      const [pendingRow] = await db.sequelize.query(
        `
          SELECT COALESCE(SUM(e.amount_cents), 0)::bigint AS "cents"
          FROM public.marketplace_earnings_ledger_entries e
          WHERE e.recipient_id = :merchantId
            AND e.entry_type = 'sale_credit'
        `,
        {
          replacements: { merchantId: userId },
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );
      pendingCreditsCents = Number(pendingRow?.cents || 0) || 0;
    }

    const payoutsRows = db?.MarketplaceAdminTransactions
      ? await db.MarketplaceAdminTransactions.findAll({
          where: { recipient_id: userId, trans_type: "payout" },
          attributes: [
            "id",
            "amount",
            "currency",
            "status",
            "transaction_reference",
            "gateway_reference",
            "createdAt",
          ],
          order: [["createdAt", "DESC"]],
        })
      : [];

    const payoutMajorAmount = (p) => {
      const raw = p?.amount;
      const n = raw != null ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return 0;
      return n / 100;
    };

    const payoutAggRows = await db.sequelize.query(
      `
        WITH tx AS (
          SELECT t.id, t.amount, t.status, t."createdAt"
          FROM public.marketplace_admin_transactions t
          WHERE t.trans_type = 'payout'
            AND t.recipient_id = :merchantId
        ), led AS (
          SELECT
            le.marketplace_admin_transaction_id AS tx_id,
            COUNT(le.id)::bigint AS ledger_rows,
            COALESCE(SUM(le.amount_cents), 0)::bigint AS ledger_sum_cents
          FROM public.marketplace_earnings_ledger_entries le
          WHERE le.entry_type IN ('payout_debit','payout_debit_reversal')
          GROUP BY 1
        ), per_tx AS (
          SELECT
            tx.status,
            tx."createdAt",
            CASE
              WHEN COALESCE(led.ledger_rows, 0) > 0 THEN GREATEST(0, -led.ledger_sum_cents)
              ELSE COALESCE(tx.amount, 0)
            END::bigint AS paid_cents
          FROM tx
          LEFT JOIN led ON led.tx_id = tx.id
        )
        SELECT
          COALESCE(SUM(CASE WHEN status = 'completed' THEN paid_cents ELSE 0 END), 0)::bigint AS "completedCents",
          COALESCE(SUM(CASE WHEN status = 'pending' THEN paid_cents ELSE 0 END), 0)::bigint AS "pendingCents"
        FROM per_tx
      `,
      {
        replacements: { merchantId: userId },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const completedPayoutsCents = Number(payoutAggRows?.[0]?.completedCents || 0) || 0;
    const pendingPayoutsCents = Number(payoutAggRows?.[0]?.pendingCents || 0) || 0;

    let lastCompleted = null;
    for (const p of payoutsRows || []) {
      const status = String(p?.status || "").toLowerCase();
      if (status === "completed") {
        if (!lastCompleted) lastCompleted = p;
      }
    }

    const settledEarnings = settledCreditsCents / 100;
    const pendingSettlement = pendingCreditsCents / 100;
    const totalPaidOut = completedPayoutsCents / 100;
    const totalPendingPayouts = pendingPayoutsCents / 100;
    const monthEarnings = monthSettledCreditsCents / 100;
    const lastMonthEarnings = lastMonthSettledCreditsCents / 100;

    const growthPercent =
      lastMonthEarnings > 0
        ? ((monthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100
        : monthEarnings > 0
          ? 100
          : 0;

    const availableToWithdrawRaw = settledEarnings - totalPaidOut - totalPendingPayouts;
    const availableToWithdraw = Math.max(0, availableToWithdrawRaw);
    const withdrawalDeficit = Math.max(0, -availableToWithdrawRaw);

    const payoutSummary = {
      currency: "USD",
      totalEarnings: settledEarnings + pendingSettlement,
      settledEarnings,
      pendingSettlement,
      availableToWithdraw,
      withdrawalDeficit,
      totalPaidOut,
      pendingPayouts: totalPendingPayouts,
      lastPayout: lastCompleted ? payoutMajorAmount(lastCompleted) : 0,
      lastPayoutDate: lastCompleted?.createdAt || null,
      thisMonthEarnings: monthEarnings,
      lastMonthEarnings,
      growthPercent,
    };

    const payoutTransactions = (payoutsRows || []).map((p) => ({
      id: p.id,
      amount: payoutMajorAmount(p),
      currency: p.currency,
      status: p.status,
      transaction_reference: p.transaction_reference,
      gateway_reference: p.gateway_reference,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      status: "success",
      profile,
      purchases,
      kyc,
      bank,
      payoutSummary,
      payoutTransactions,
    });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/account",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "marketplace_account",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to fetch account data"
          : (error?.message || "Failed to fetch account data"),
      },
      { status: 500 }
    );
  }
}
