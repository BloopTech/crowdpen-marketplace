import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getMarketplaceFeePercents } from "../../../lib/marketplaceFees";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

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
        const canDownload = !revoked && (Boolean(downloadUrl) || Boolean(productFile));
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
          status: order.paymentStatus || order.orderStatus || "processing",
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

    const { crowdpenPct: CROWD_PCT, startbuttonPct: SB_PCT } =
      await getMarketplaceFeePercents({ db });

    const aggSqlBase = `
      SELECT
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue",
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
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"
      LEFT JOIN "marketplace_coupon_redemptions" AS r ON r."id" = ri."redemption_id"
      LEFT JOIN "marketplace_coupons" AS c ON c."id" = r."coupon_id"
      LEFT JOIN "users" AS cu ON cu."id" = c."created_by"
      WHERE p."user_id" = :merchantId
        AND o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
    `;

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

    const settledAllTimeSql = `${aggSqlBase} AND :settledTo::date IS NOT NULL AND o."createdAt"::date <= :settledTo::date`;
    const pendingAllTimeSql = `${aggSqlBase} AND (:settledTo::date IS NULL OR (o."createdAt"::date > :settledTo::date))`;
    const settledMonthSql = `${settledAllTimeSql} AND o."createdAt" >= :from AND o."createdAt" <= :to`;

    const [settledAllTimeRows, pendingAllTimeRows, settledMonthRows, settledLastMonthRows] =
      await Promise.all([
        db.sequelize.query(settledAllTimeSql, {
          replacements: { merchantId: userId, settledTo: lastSettledTo },
          type: db.Sequelize.QueryTypes.SELECT,
        }),
        db.sequelize.query(pendingAllTimeSql, {
          replacements: { merchantId: userId, settledTo: lastSettledTo },
          type: db.Sequelize.QueryTypes.SELECT,
        }),
        db.sequelize.query(settledMonthSql, {
          replacements: {
            merchantId: userId,
            settledTo: lastSettledTo,
            from: monthStart,
            to: now,
          },
          type: db.Sequelize.QueryTypes.SELECT,
        }),
        db.sequelize.query(settledMonthSql, {
          replacements: {
            merchantId: userId,
            settledTo: lastSettledTo,
            from: lastMonthStart,
            to: lastMonthEnd,
          },
          type: db.Sequelize.QueryTypes.SELECT,
        }),
      ]);

    const calcNetEarnings = (row) => {
      const revenue = Number(row?.revenue || 0) || 0;
      const discountTotal = Number(row?.discountTotal || 0) || 0;
      const discountMerchantFunded = Number(row?.discountMerchantFunded || 0) || 0;
      const buyerPaid = Math.max(0, revenue - discountTotal);
      const crowdpenFee = revenue * (CROWD_PCT || 0);
      const startbuttonFee = buyerPaid * (SB_PCT || 0);
      return Math.max(
        0,
        revenue - discountMerchantFunded - crowdpenFee - startbuttonFee
      );
    };

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

    const settledEarnings = calcNetEarnings(settledAllTimeRows?.[0]);
    const pendingSettlement = calcNetEarnings(pendingAllTimeRows?.[0]);

    let totalPaidOut = 0;
    let totalPendingPayouts = 0;
    let lastCompleted = null;
    for (const p of payoutsRows || []) {
      const status = String(p?.status || "").toLowerCase();
      const amt = payoutMajorAmount(p);
      if (status === "completed") {
        totalPaidOut += amt;
        if (!lastCompleted) lastCompleted = p;
      } else if (status === "pending") {
        totalPendingPayouts += amt;
      }
    }

    const monthEarnings = calcNetEarnings(settledMonthRows?.[0]);

    const lastMonthEarnings = calcNetEarnings(settledLastMonthRows?.[0]);

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
