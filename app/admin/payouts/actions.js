"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";

function parsePct(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/%/g, ""));
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
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
  return user?.role === "admin" || user?.role === "senior_admin";
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
        AND LOWER(o."paymentStatus"::text) IN ('successful', 'completed')
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

  const revenueSql = `
    SELECT COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue"
    FROM "marketplace_order_items" AS oi
    JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
    JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
    WHERE p."user_id" = :merchantId
      AND LOWER(o."paymentStatus"::text) IN ('successful', 'completed')
      AND o."createdAt" >= :from
      AND o."createdAt" <= :to
  `;

  const revenueRows = await db.sequelize.query(revenueSql, {
    replacements: { merchantId: recipient_id, from: fromDate, to: toDate },
    type: db.Sequelize.QueryTypes.SELECT,
  });
  const revenue = Number(revenueRows?.[0]?.revenue || 0) || 0;
  const crowdpenFee = revenue * (CROWD_PCT || 0);
  const startbuttonFee = revenue * (SB_PCT || 0);
  const expectedPayout = Math.max(0, revenue - crowdpenFee - startbuttonFee);

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

  revalidatePath("/admin/payouts");
  revalidatePath("/admin/transactions");
  return { success: true, message: "Payout recorded", data: { id: tx.id } };
}
