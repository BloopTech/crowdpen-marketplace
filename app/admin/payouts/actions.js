"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";
import { getMarketplaceFeePercents } from "../../lib/marketplaceFees";
import { render } from "@react-email/render";
import { sendEmail } from "../../lib/sendEmail";
import { PayoutReceiptEmail } from "../../lib/emails/PayoutReceipt";

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

function settlementKey(fromDate, toDate) {
  const fromKey = fromDate.toISOString().slice(0, 10);
  const toKey = toDate.toISOString().slice(0, 10);
  return `settlement:${fromKey}:${toKey}`;
}

function isoDay(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function addDaysIso(dayStr, days) {
  const d = new Date(`${dayStr}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isAdminOrSenior(user) {
  return user?.crowdpen_staff === true || user?.role === "admin" || user?.role === "senior_admin";
}

function fmtDateTimeUtc(v) {
  const d = v ? new Date(v) : null;
  if (!d || !Number.isFinite(d.getTime())) return null;
  return d.toLocaleString("en-US", { timeZone: "UTC" });
}

function getFinancePayoutBcc() {
  const raw =
    process.env.PAYOUT_RECEIPTS_BCC ||
    process.env.PAYOUT_RECEIPT_BCC ||
    process.env.FINANCE_PAYOUT_BCC ||
    process.env.FINANCE_EMAIL ||
    "";
  const s = String(raw || "").trim();
  return s ? s : null;
}

export async function createPayout(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }

  const recipient_id = String(formData.get("recipient_id") || "").trim();
  const currency = String(formData.get("currency") || "").trim() || "USD";
  const status = String(formData.get("status") || "").trim() || "pending";
  const transaction_reference = String(formData.get("transaction_reference") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const fromParam = String(formData.get("from") || "").trim();
  const toParam = String(formData.get("to") || "").trim();

  const fromDate = parseDateSafe(fromParam);
  const toDate = parseDateEndUtc(toParam);
  if (!recipient_id || !fromDate || !toDate) {
    return { success: false, message: "Invalid inputs" };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const toIso = String(toParam).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toIso) || toIso > todayIso) {
    return { success: false, message: "Invalid payout period" };
  }

  const normalizedStatus = ["pending", "completed", "failed", "cancelled"].includes(
    status.toLowerCase()
  )
    ? status.toLowerCase()
    : "pending";

  const user = await db.User.findOne({ where: { id: recipient_id } });
  if (!user) return { success: false, message: "Recipient not found" };
  if (!user.merchant) return { success: false, message: "Recipient is not a merchant" };

  let lastSettledToIso = null;
  try {
    const [row] = await db.sequelize.query(
      `
        SELECT MAX(settlement_to) AS "lastSettledTo"
        FROM public.marketplace_payout_periods
        WHERE recipient_id = :merchantId
          AND is_active = TRUE
      `,
      {
        replacements: { merchantId: recipient_id },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );
    lastSettledToIso = isoDay(row?.lastSettledTo);
  } catch (e) {
    const code = e?.original?.code || e?.code;
    if (code === "42P01") {
      return {
        success: false,
        message: "Payout periods table is missing. Apply the payout periods migration first.",
      };
    }
    throw e;
  }

  const [windowSales] = await db.sequelize.query(
    `
      SELECT
        MIN(o."createdAt")::date AS "firstUnsettledSale",
        MAX(o."createdAt")::date AS "lastUnsettledSale"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      WHERE p."user_id" = :merchantId
        AND o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        AND (:lastSettledTo::date IS NULL OR (o."createdAt"::date > :lastSettledTo::date))
    `,
    {
      replacements: { merchantId: recipient_id, lastSettledTo: lastSettledToIso },
      type: db.Sequelize.QueryTypes.SELECT,
    }
  );

  const eligibleFromIso = isoDay(windowSales?.firstUnsettledSale);
  const lastUnsettledIso = isoDay(windowSales?.lastUnsettledSale);
  if (!eligibleFromIso || !lastUnsettledIso) {
    return { success: false, message: "No eligible sales to settle" };
  }

  const maxToIso = [todayIso, lastUnsettledIso].sort()[0];
  if (eligibleFromIso > maxToIso) {
    return { success: false, message: "No payout period available to settle" };
  }

  const fromIso = String(fromParam).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || fromIso !== eligibleFromIso) {
    return {
      success: false,
      message: `Invalid payout start date. Next eligible start is ${eligibleFromIso}.`,
    };
  }
  if (toIso !== maxToIso) {
    return {
      success: false,
      message: `Invalid payout end date. Expected ${maxToIso}.`,
    };
  }

  const { crowdpenPct: CROWD_PCT, startbuttonPct: SB_PCT } =
    await getMarketplaceFeePercents({ db });

  const revenueSql = `
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
      AND o."createdAt" >= :from
      AND o."createdAt" <= :to
  `;

  const revenueRows = await db.sequelize.query(revenueSql, {
    replacements: { merchantId: recipient_id, from: fromDate, to: toDate },
    type: db.Sequelize.QueryTypes.SELECT,
  });
  const revenue = Number(revenueRows?.[0]?.revenue || 0) || 0;
  const discountTotal = Number(revenueRows?.[0]?.discountTotal || 0) || 0;
  const discountMerchantFunded =
    Number(revenueRows?.[0]?.discountMerchantFunded || 0) || 0;
  const buyerPaid = Math.max(0, revenue - discountTotal);
  const crowdpenFee = revenue * (CROWD_PCT || 0);
  const startbuttonFee = buyerPaid * (SB_PCT || 0);
  const expectedPayout = Math.max(
    0,
    revenue - discountMerchantFunded - crowdpenFee - startbuttonFee
  );

  const key = settlementKey(fromDate, toDate);

  const paidRows = await db.MarketplaceAdminTransactions.findAll({
    where: {
      trans_type: "payout",
      recipient_id,
      status: ["pending", "completed"],
      [db.Sequelize.Op.or]: [
        { transaction_id: key },
        {
          transaction_id: { [db.Sequelize.Op.is]: null },
          createdAt: { [db.Sequelize.Op.gte]: fromDate, [db.Sequelize.Op.lte]: toDate },
        },
      ],
    },
    attributes: ["amount"],
  });
  const alreadyPaidCents = (paidRows || []).reduce(
    (acc, r) => acc + (Number(r?.amount || 0) || 0),
    0
  );

  const expectedCents = Math.round(expectedPayout * 100);
  const remainingCents = expectedCents - alreadyPaidCents;
  if (!Number.isFinite(remainingCents) || remainingCents <= 0) {
    return {
      success: false,
      message: "No payout remaining for the selected period",
    };
  }

  const isActivePeriod = ["pending", "completed"].includes(normalizedStatus);

  const tx = await db.sequelize.transaction(async (t) => {
    const payoutTx = await db.MarketplaceAdminTransactions.create(
      {
        recipient_id,
        trans_type: "payout",
        status: normalizedStatus,
        transaction_id: key,
        amount: remainingCents,
        currency,
        transaction_reference,
        gateway_reference: note,
        completedAt: normalizedStatus === "completed" ? new Date() : null,
        created_by: session.user.id,
        created_via: "admin_single",
      },
      { transaction: t }
    );

    await db.MarketplacePayoutEvent.create(
      {
        marketplace_admin_transaction_id: payoutTx.id,
        event_type: "payout_created",
        from_status: null,
        to_status: normalizedStatus,
        actor_type: "admin",
        actor_user_id: session.user.id,
        metadata: {
          recipient_id,
          settlement_from: fromIso,
          settlement_to: toIso,
          amount_cents: remainingCents,
          currency,
        },
      },
      { transaction: t }
    );

    try {
      await db.sequelize.query(
        `
          INSERT INTO public.marketplace_payout_periods (
            recipient_id,
            marketplace_admin_transaction_id,
            settlement_from,
            settlement_to,
            is_active,
            "createdAt",
            "updatedAt"
          ) VALUES (
            :recipientId,
            :txId,
            :from::date,
            :to::date,
            :isActive,
            now(),
            now()
          )
        `,
        {
          replacements: {
            recipientId: recipient_id,
            txId: payoutTx.id,
            from: fromIso,
            to: toIso,
            isActive: isActivePeriod,
          },
          transaction: t,
          type: db.Sequelize.QueryTypes.INSERT,
        }
      );
    } catch (e) {
      const code = e?.original?.code || e?.code;
      const constraint = e?.original?.constraint || e?.constraint;
      if (code === "23P01" || constraint === "marketplace_payout_periods_no_overlap") {
        throw new Error(
          `This merchant has already been paid for part/all of this date range. Next eligible start is ${eligibleFromIso}.`
        );
      }
      if (code === "23514" || constraint === "marketplace_payout_periods_range_check") {
        throw new Error("Invalid payout period");
      }
      if (code === "42P01") {
        throw new Error(
          "Payout periods table is missing. Apply the payout periods migration first."
        );
      }
      throw e;
    }

    return payoutTx;
  });

  // If admin marks as completed immediately, send receipt now (best-effort, idempotent).
  if (normalizedStatus === "completed") {
    try {
      const user = await db.User.findOne({ where: { id: recipient_id } });
      const toEmail = user?.email ? String(user.email).trim() : "";
      if (toEmail) {
        await db.MarketplacePayoutReceipt.findOrCreate({
          where: { marketplace_admin_transaction_id: tx.id },
          defaults: {
            marketplace_admin_transaction_id: tx.id,
            recipient_id,
            to_email: toEmail,
            bcc_email: getFinancePayoutBcc(),
            subject: "Crowdpen payout receipt",
            status: "queued",
            sent_at: null,
          },
        });

        const receiptRow = await db.MarketplacePayoutReceipt.findOne({
          where: { marketplace_admin_transaction_id: tx.id },
        });

        if (receiptRow && !receiptRow.sent_at) {
          await receiptRow.update({ status: "sending" });

          const [period] = await db.sequelize.query(
            `
              SELECT settlement_from AS "settlementFrom", settlement_to AS "settlementTo"
              FROM public.marketplace_payout_periods
              WHERE marketplace_admin_transaction_id = :txId
              LIMIT 1
            `,
            {
              replacements: { txId: tx.id },
              type: db.Sequelize.QueryTypes.SELECT,
            }
          );

          const currencyUp = (tx?.currency || "USD").toString().toUpperCase();
          const amountMajor = Number(tx?.amount || 0) / 100;
          const paidAtUtc = fmtDateTimeUtc(tx?.completedAt || new Date());

          const html = render(
            PayoutReceiptEmail({
              merchantName: user?.name || null,
              merchantEmail: toEmail,
              payoutId: tx.id,
              amount: amountMajor,
              currency: currencyUp,
              paidAt: paidAtUtc,
              settlementFrom: period?.settlementFrom ? String(period.settlementFrom) : null,
              settlementTo: period?.settlementTo ? String(period.settlementTo) : null,
              reference: tx?.transaction_reference || tx?.gateway_reference || tx?.transaction_id || null,
            })
          );

          const subject = `Crowdpen payout receipt - ${amountMajor.toFixed(2)} ${currencyUp}`;
          const bcc = receiptRow.bcc_email || getFinancePayoutBcc();
          const text = `Payout receipt. Amount: ${amountMajor.toFixed(2)} ${currencyUp}. Payout ID: ${tx.id}.`;
          const result = await sendEmail({ to: toEmail, bcc, subject, html, text });

          await receiptRow.update({
            subject,
            html,
            text,
            provider_message_id: result?.messageId || null,
            status: "sent",
            sent_at: new Date(),
            error: null,
          });

          await db.MarketplacePayoutEvent.create({
            marketplace_admin_transaction_id: tx.id,
            event_type: "payout_receipt_sent",
            from_status: null,
            to_status: null,
            actor_type: "system_email",
            actor_user_id: null,
            metadata: { to: toEmail, bcc: bcc || null },
          });
        }
      }
    } catch (e) {
      console.error("payout receipt email error", e);
      try {
        await db.MarketplacePayoutReceipt.update(
          { status: "error", error: e?.message || "Failed to send receipt" },
          { where: { marketplace_admin_transaction_id: tx.id, sent_at: null } }
        );
        await db.MarketplacePayoutEvent.create({
          marketplace_admin_transaction_id: tx.id,
          event_type: "payout_receipt_failed",
          from_status: null,
          to_status: null,
          actor_type: "system_email",
          actor_user_id: null,
          metadata: { error: e?.message || "Failed" },
        });
      } catch {
        // best-effort
      }
    }
  }

  revalidatePath("/admin/payouts");
  revalidatePath("/admin/transactions");
  return { success: true, message: "Payout recorded", data: { id: tx.id } };
}
