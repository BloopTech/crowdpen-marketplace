import { NextResponse } from "next/server";
import crypto from "crypto";
import { Op } from "sequelize";
import { db } from "../../../../models";
import { render, pretty } from "@react-email/render";
import { sendEmail } from "../../../../lib/sendEmail";
import { OrderConfirmationEmail } from "../../../../lib/emails/OrderConfirmation";
import { PayoutReceiptEmail } from "../../../../lib/emails/PayoutReceipt";
import { getMarketplaceFeePercents } from "../../../../lib/marketplaceFees";
import {
  getClientIpFromHeaders,
  rateLimit,
  rateLimitResponseHeaders,
} from "../../../../lib/security/rateLimit";
import {
  getRequestIdFromHeaders,
  reportError,
} from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

const {
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceProduct,
  MarketplaceCoupon,
  MarketplaceCouponRedemption,
  MarketplaceAdminTransactions,
  MarketplacePayoutReceipt,
  MarketplacePayoutEvent,
  User,
  sequelize,
} = db;

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

function getPaystackSecretKey() {
  return (process.env.PAYSTACK_SECRETKEY || "").toString().trim();
}

async function verifyPaystackTransaction(reference) {
  const secret = getPaystackSecretKey();
  if (!secret) throw new Error("Paystack secret not configured");
  const ref = (reference || "").toString().trim();
  if (!ref) throw new Error("Missing Paystack reference");

  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`;
  const upstream = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const json = await upstream.json().catch(() => ({}));
  if (!upstream.ok || json?.status !== true) {
    const msg = json?.message || "Verification failed";
    throw new Error(msg);
  }
  return json?.data || null;
}

function bufferToString(buf) {
  try {
    if (typeof buf === "string") return buf;
    return Buffer.from(buf).toString("utf8");
  } catch {
    return "";
  }
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function refreshProductSalesMaterializedView({ requestId }) {
  try {
    await sequelize.query(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_product_sales'
    );
  } catch (e) {
    const code = e?.original?.code || e?.code;
    if (code === "42P01") return;
    const msg = String(e?.message || "");
    if (
      msg.toLowerCase().includes("refresh") &&
      msg.toLowerCase().includes("concurrently") &&
      msg.toLowerCase().includes("transaction")
    ) {
      return;
    }
    await reportError(e, {
      route: "/api/marketplace/paystack/webhook",
      method: "POST",
      status: 200,
      requestId,
      tag: "paystack_webhook_refresh_mv_product_sales",
    });
  }
}

function firstString(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function looksLikeTransferEvent(payload) {
  const s = String(payload?.event || "").toLowerCase();
  return s.startsWith("transfer.");
}

function mapTransferStatus(payload) {
  const s = String(payload?.event || payload?.data?.status || "").toLowerCase();
  if (s.includes("success")) return "completed";
  if (s.includes("failed")) return "failed";
  if (s.includes("reversed")) return "reversed";
  if (s.includes("pending") || s.includes("queued")) return "pending";
  return null;
}

function extractTransferReferences(payload) {
  const tx = payload?.data || {};
  const candidates = [
    tx?.reference,
    tx?.transfer_code,
    tx?.id,
    payload?.reference,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return Array.from(new Set(candidates));
}

function isRevokedValue(value) {
  const s = value != null ? String(value).trim() : "";
  return s.toUpperCase() === "REVOKED";
}

function isOrderSuccessful(order) {
  const payment = (order?.paymentStatus || "").toString().toLowerCase();
  const status = (order?.orderStatus || "").toString().toLowerCase();
  return payment === "successful" || status === "successful";
}

async function writeSaleCreditsForOrder({ order, transaction }) {
  const orderId = order?.id;
  if (!orderId) return;

  const { crowdpenPct: crowdPct, startbuttonPct: sbPct } =
    await getMarketplaceFeePercents({ db });

  const currency = String(order?.currency || order?.paid_currency || "USD")
    .trim()
    .toUpperCase();
  const paymentProvider = String(order?.payment_provider || "paystack").trim();
  const orderNumber = order?.order_number
    ? String(order.order_number).trim()
    : null;
  const paystackReferenceId = order?.paystackReferenceId
    ? String(order.paystackReferenceId).trim()
    : null;
  const earnedAt = order?.createdAt ? new Date(order.createdAt) : new Date();

  await sequelize.query(
    `
      WITH item_facts AS (
        SELECT
          oi.id AS order_item_id,
          p.user_id AS merchant_id,
          (oi.subtotal)::numeric AS revenue,
          COALESCE(SUM(ri.discount_amount)::numeric, 0) AS discount_total,
          COALESCE(
            SUM(
              CASE
                WHEN cu.id IS NULL
                  OR cu.crowdpen_staff = TRUE
                  OR cu.role IN ('admin','senior_admin')
                THEN 0
                ELSE ri.discount_amount
              END
            )::numeric,
            0
          ) AS discount_merchant_funded
        FROM public.marketplace_order_items oi
        JOIN public.marketplace_products p ON p.id = oi.marketplace_product_id
        LEFT JOIN public.marketplace_coupon_redemption_items ri ON ri.order_item_id = oi.id
        LEFT JOIN public.marketplace_coupon_redemptions r ON r.id = ri.redemption_id
        LEFT JOIN public.marketplace_coupons c ON c.id = r.coupon_id
        LEFT JOIN public.users cu ON cu.id = c.created_by
        WHERE oi.marketplace_order_id = :orderId
        GROUP BY oi.id, p.user_id, oi.subtotal
      )
      INSERT INTO public.marketplace_earnings_ledger_entries (
        recipient_id,
        amount_cents,
        currency,
        entry_type,
        marketplace_order_id,
        marketplace_order_item_id,
        earned_at,
        metadata,
        "createdAt",
        "updatedAt"
      )
      SELECT
        merchant_id,
        ROUND(
          GREATEST(
            0,
            (revenue - discount_merchant_funded)
              - (revenue * :crowdPct::numeric)
              - ((revenue - discount_total) * :sbPct::numeric)
          ) * 100
        )::bigint,
        :currency,
        'sale_credit',
        :orderId,
        order_item_id,
        :earnedAt,
        jsonb_build_object(
          'order_number', :orderNumber,
          'payment_provider', :paymentProvider,
          'paystack_reference', :paystackReferenceId,
          'crowdpen_fee_pct', :crowdPct,
          'startbutton_fee_pct', :sbPct
        ),
        now(),
        now()
      FROM item_facts
      ON CONFLICT (marketplace_order_item_id)
        WHERE entry_type = 'sale_credit'
      DO NOTHING
    `,
    {
      replacements: {
        orderId,
        currency,
        paymentProvider,
        orderNumber,
        paystackReferenceId,
        earnedAt,
        crowdPct: Number(crowdPct || 0),
        sbPct: Number(sbPct || 0),
      },
      transaction,
      type: db.Sequelize.QueryTypes.INSERT,
    }
  );
}

async function fulfillOrderTransactional(orderId, t) {
  const lockedOrder = await MarketplaceOrder.findOne({
    where: { id: orderId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (!lockedOrder) throw new Error("Order not found");

  const alreadySuccessful = isOrderSuccessful(lockedOrder);

  // Decrement stock for each order item (same as checkout finalize)
  const items = await MarketplaceOrderItems.findAll({
    where: { marketplace_order_id: lockedOrder.id },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  for (const it of items) {
    const product = await MarketplaceProduct.findByPk(
      it.marketplace_product_id,
      {
        transaction: t,
        lock: t.LOCK.UPDATE,
      }
    );
    if (
      product &&
      product.stock !== null &&
      typeof product.stock !== "undefined"
    ) {
      const current = Number(product.stock);
      const qty = Number(it.quantity);
      if (current < qty) {
        throw new Error(`Insufficient stock for ${product.title}`);
      }
      const newStock = current - qty;
      await product.update(
        { stock: newStock, inStock: newStock > 0 },
        { transaction: t }
      );
    }
  }

  // Clear cart
  const cart = await MarketplaceCart.findOne({
    where: { user_id: lockedOrder.user_id, active: true },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (cart) {
    await MarketplaceCartItems.destroy({
      where: { marketplace_cart_id: cart.id },
      transaction: t,
    });
    await cart.update(
      {
        subtotal: 0,
        discount: 0,
        total: 0,
        coupon_id: null,
        coupon_code: null,
        coupon_applied_at: null,
      },
      { transaction: t }
    );
  }

  const redemption = await MarketplaceCouponRedemption.findOne({
    where: { order_id: lockedOrder.id },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (redemption && redemption.status !== "successful") {
    await redemption.update({ status: "successful" }, { transaction: t });
    await MarketplaceCoupon.increment(
      { usage_count: 1 },
      { where: { id: redemption.coupon_id }, transaction: t }
    );
  }

  return { alreadySuccessful };
}

export async function POST(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  try {
    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({
      key: `paystack-webhook:${ip}`,
      limit: 600,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const signature = (request.headers.get("x-paystack-signature") || "")
      .toString()
      .trim();
    const secret = (process.env.PAYSTACK_SECRETKEY || "").toString().trim();

    if (process.env.NODE_ENV === "production" && !secret) {
      return NextResponse.json(
        { status: "error", message: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const rawBodyBuf = await request.arrayBuffer();
    const rawBody = bufferToString(rawBodyBuf);

    if (secret) {
      const computed = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      const sigOk =
        signature &&
        computed &&
        signature.length === computed.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));

      if (!sigOk) {
        return NextResponse.json(
          { status: "error", message: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const payload = safeJsonParse(rawBody) || {};
    const event = (payload?.event || "").toString().trim().toLowerCase();
    const data = payload?.data || {};

    if (looksLikeTransferEvent(payload)) {
      const transferStatus = mapTransferStatus(payload);
      const references = extractTransferReferences(payload);

      if (!transferStatus || !references.length) {
        return NextResponse.json({
          status: "success",
          message: "Transfer webhook received",
        });
      }

      const payoutTx = await MarketplaceAdminTransactions.findOne({
        where: {
          trans_type: "payout",
          [Op.or]: [
            { transaction_reference: { [Op.in]: references } },
            { gateway_reference: { [Op.in]: references } },
            { transaction_id: { [Op.in]: references } },
          ],
        },
      });

      if (!payoutTx) {
        return NextResponse.json({
          status: "success",
          message: "Transfer webhook received",
        });
      }

      const t = await sequelize.transaction();
      try {
        const lockedTx = await MarketplaceAdminTransactions.findOne({
          where: { id: payoutTx.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!lockedTx) throw new Error("Payout transaction not found");

        const current = String(lockedTx.status || "").toLowerCase();
        const statusChanged = current !== transferStatus;
        const becameCompleted =
          transferStatus === "completed" && current !== "completed";

        const updates = {};
        if (current !== transferStatus) updates.status = transferStatus;

        const txData = payload?.data || {};
        if (!lockedTx.transaction_reference && txData?.reference) {
          updates.transaction_reference = String(txData.reference).trim();
        }
        if (!lockedTx.gateway_reference && txData?.transfer_code) {
          updates.gateway_reference = String(txData.transfer_code).trim();
        }
        if (txData?.amount != null && !lockedTx.amount) {
          const amt = Number(txData.amount);
          if (Number.isFinite(amt) && amt > 0) updates.amount = amt;
        }
        if (txData?.currency && !lockedTx.currency) {
          updates.currency = String(txData.currency).toUpperCase();
        }
        if (transferStatus === "completed" && !lockedTx.completedAt) {
          updates.completedAt = new Date();
        }

        if (Object.keys(updates).length) {
          await lockedTx.update(updates, { transaction: t });
        }

        if (statusChanged) {
          await MarketplacePayoutEvent.create(
            {
              marketplace_admin_transaction_id: lockedTx.id,
              event_type: "payout_status_changed",
              from_status: current || null,
              to_status: transferStatus || null,
              actor_type: "paystack_webhook",
              actor_user_id: null,
              metadata: { references },
            },
            { transaction: t }
          );

          const toStatus = String(transferStatus || "").toLowerCase();
          const needsReversal = ["failed", "reversed", "cancelled"].includes(
            toStatus
          );
          if (needsReversal) {
            await db.sequelize.query(
              `
                INSERT INTO public.marketplace_earnings_ledger_entries (
                  recipient_id,
                  amount_cents,
                  currency,
                  entry_type,
                  marketplace_admin_transaction_id,
                  earned_at,
                  metadata,
                  "createdAt",
                  "updatedAt"
                )
                SELECT
                  :recipientId,
                  :amountCents,
                  :currency,
                  'payout_debit_reversal',
                  :txId,
                  now(),
                  :metadata::jsonb,
                  now(),
                  now()
                WHERE EXISTS (
                  SELECT 1
                  FROM public.marketplace_earnings_ledger_entries e
                  WHERE e.marketplace_admin_transaction_id = :txId
                    AND e.entry_type = 'payout_debit'
                )
                ON CONFLICT (marketplace_admin_transaction_id)
                  WHERE entry_type = 'payout_debit_reversal'
                DO NOTHING
              `,
              {
                replacements: {
                  recipientId: lockedTx.recipient_id,
                  txId: lockedTx.id,
                  amountCents: Math.abs(Number(lockedTx.amount || 0) || 0),
                  currency: String(lockedTx.currency || "USD").toUpperCase(),
                  metadata: JSON.stringify({
                    references,
                    from_status: current || null,
                    to_status: toStatus,
                    actor_type: "paystack_webhook",
                  }),
                },
                transaction: t,
                type: db.Sequelize.QueryTypes.INSERT,
              }
            );
          }
        }

        if (becameCompleted) {
          const recipient = await User.findOne({
            where: { id: lockedTx.recipient_id },
            transaction: t,
          });
          const toEmail = recipient?.email
            ? String(recipient.email).trim()
            : "";
          if (toEmail) {
            const bcc = getFinancePayoutBcc();
            await MarketplacePayoutReceipt.findOrCreate({
              where: { marketplace_admin_transaction_id: lockedTx.id },
              defaults: {
                marketplace_admin_transaction_id: lockedTx.id,
                recipient_id: lockedTx.recipient_id,
                to_email: toEmail,
                bcc_email: bcc,
                subject: "Crowdpen payout receipt",
                status: "queued",
                sent_at: null,
              },
              transaction: t,
            });
          }
        }

        await t.commit();
      } catch (e) {
        await t.rollback();
        throw e;
      }

      if (transferStatus === "completed") {
        try {
          const t2 = await sequelize.transaction();
          let claimed = false;
          let receiptRow = null;
          try {
            receiptRow = await MarketplacePayoutReceipt.findOne({
              where: { marketplace_admin_transaction_id: payoutTx.id },
              transaction: t2,
              lock: t2.LOCK.UPDATE,
            });
            if (
              receiptRow &&
              !receiptRow.sent_at &&
              receiptRow.status !== "sending"
            ) {
              await receiptRow.update(
                { status: "sending" },
                { transaction: t2 }
              );
              claimed = true;
            }
            await t2.commit();
          } catch (e) {
            await t2.rollback();
            throw e;
          }

          if (claimed && receiptRow) {
            const txFresh = await MarketplaceAdminTransactions.findOne({
              where: { id: payoutTx.id },
            });
            const recipient = txFresh
              ? await User.findOne({ where: { id: txFresh.recipient_id } })
              : null;

            const [period] = await sequelize.query(
              `
                SELECT settlement_from AS "settlementFrom", settlement_to AS "settlementTo"
                FROM public.marketplace_payout_periods
                WHERE marketplace_admin_transaction_id = :txId
                LIMIT 1
              `,
              {
                replacements: { txId: payoutTx.id },
                type: db.Sequelize.QueryTypes.SELECT,
              }
            );

            const currency = (txFresh?.currency || "USD")
              .toString()
              .toUpperCase();
            const amountMajor = Number(txFresh?.amount || 0) / 100;
            const paidAtUtc = fmtDateTimeUtc(
              txFresh?.completedAt || new Date()
            );
            const settlementFrom = period?.settlementFrom
              ? String(period.settlementFrom)
              : null;
            const settlementTo = period?.settlementTo
              ? String(period.settlementTo)
              : null;
            const reference =
              txFresh?.transaction_reference ||
              txFresh?.gateway_reference ||
              txFresh?.transaction_id ||
              null;

            const merchantName = recipient?.name || null;
            const merchantEmail = receiptRow.to_email;

            const html = await pretty(
              await render(
                <PayoutReceiptEmail
                  merchantName={merchantName}
                  merchantEmail={merchantEmail}
                  payoutId={payoutTx.id}
                  amount={amountMajor}
                  currency={currency}
                  paidAt={paidAtUtc}
                  settlementFrom={settlementFrom}
                  settlementTo={settlementTo}
                  reference={reference}
                />
              )
            );

            const subject = `Crowdpen payout receipt - ${amountMajor.toFixed(2)} ${currency}`;
            const bcc = receiptRow.bcc_email || getFinancePayoutBcc();

            const result = await sendEmail({
              to: receiptRow.to_email,
              bcc,
              subject,
              html,
              text: `Payout receipt. Amount: ${amountMajor.toFixed(2)} ${currency}. Payout ID: ${payoutTx.id}.`,
            });

            await MarketplacePayoutReceipt.update(
              {
                subject,
                html,
                text: `Payout receipt. Amount: ${amountMajor.toFixed(2)} ${currency}. Payout ID: ${payoutTx.id}.`,
                provider_message_id: result?.messageId || null,
                status: "sent",
                sent_at: new Date(),
                error: null,
              },
              { where: { marketplace_admin_transaction_id: payoutTx.id } }
            );

            await MarketplacePayoutEvent.create({
              marketplace_admin_transaction_id: payoutTx.id,
              event_type: "payout_receipt_sent",
              from_status: null,
              to_status: null,
              actor_type: "system_email",
              actor_user_id: null,
              metadata: { to: receiptRow.to_email, bcc: bcc || null },
            });
          }
        } catch (e) {
          await reportError(e, {
            route: "/api/marketplace/paystack/webhook",
            method: "POST",
            status: 200,
            requestId,
            tag: "paystack_webhook_payout_receipt_email",
            extra: { stage: "payout_receipt_email" },
          });
          try {
            await MarketplacePayoutReceipt.update(
              {
                status: "error",
                error: e?.message || "Failed to send receipt",
              },
              {
                where: {
                  marketplace_admin_transaction_id: payoutTx.id,
                  sent_at: null,
                },
              }
            );
            await MarketplacePayoutEvent.create({
              marketplace_admin_transaction_id: payoutTx.id,
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

      return NextResponse.json({
        status: "success",
        message: "Payout transaction updated",
      });
    }

    const reference =
      (data?.reference || payload?.reference || "").toString().trim() || null;
    const meta = data?.metadata || payload?.metadata || {};
    const orderId = (meta?.orderId || "").toString().trim() || null;

    if (!reference && !orderId) {
      return NextResponse.json(
        { status: "error", message: "Missing reference" },
        { status: 400 }
      );
    }

    let order = null;
    if (orderId) {
      order = await MarketplaceOrder.findOne({ where: { id: orderId } });
    }
    if (!order && reference) {
      order = await MarketplaceOrder.findOne({
        where: { paystackReferenceId: reference },
      });
    }

    if (!order) {
      return NextResponse.json(
        { status: "error", message: "Order not found" },
        { status: 404 }
      );
    }

    // Always verify with Paystack before marking paid.
    let verified = null;
    try {
      verified = await verifyPaystackTransaction(
        reference || order.paystackReferenceId
      );
    } catch (e) {
      await reportError(e, {
        route: "/api/marketplace/paystack/webhook",
        method: "POST",
        status: 502,
        requestId,
        tag: "paystack_webhook_verify_failed",
        extra: {
          event,
          reference: reference || null,
          orderId: order?.id || null,
        },
      });
      return NextResponse.json(
        { status: "error", message: "Verification failed" },
        { status: 502 }
      );
    }

    const vStatus = (verified?.status || "").toString().toLowerCase();
    const isSuccess = vStatus === "success";

    const t = await sequelize.transaction();
    try {
      const locked = await MarketplaceOrder.findOne({
        where: { id: order.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!locked) throw new Error("Order not found");

      const alreadySuccessful = isOrderSuccessful(locked);

      const notesPart = `Paystack webhook: ${new Date().toISOString()}${event ? ` event=${event}` : ""}${reference ? ` ref=${reference}` : ""}${isSuccess ? " paid" : ""}`;
      const mergedNotes = notesPart
        ? locked.notes
          ? locked.notes.includes(notesPart)
            ? locked.notes
            : `${locked.notes}\n${notesPart}`
          : notesPart
        : locked.notes;

      // Idempotency: if already successful, just return success.
      if (alreadySuccessful) {
        await locked.update(
          {
            payment_provider: locked.payment_provider || "paystack",
            ...(reference ? { paystackReferenceId: reference } : {}),
            notes: mergedNotes,
          },
          { transaction: t }
        );
        await t.commit();

        await refreshProductSalesMaterializedView({ requestId });

        return NextResponse.json({
          status: "success",
          message: "Already processed",
        });
      }

      if (!isSuccess) {
        await locked.update(
          {
            paymentStatus: "failed",
            orderStatus: "failed",
            payment_provider: locked.payment_provider || "paystack",
            ...(reference ? { paystackReferenceId: reference } : {}),
            notes: mergedNotes,
          },
          { transaction: t }
        );
        await t.commit();
        return NextResponse.json({
          status: "success",
          message: "Marked failed",
        });
      }

      const vAmount = Number(verified?.amount);
      const vCurrency = (verified?.currency || "")
        .toString()
        .trim()
        .toUpperCase();
      const paid_amount =
        Number.isFinite(vAmount) && vAmount > 0
          ? Number((vAmount / 100).toFixed(2))
          : null;

      const expectedMinor = Math.round(Number(locked.paid_amount || 0) * 100);
      if (
        Number.isFinite(expectedMinor) &&
        expectedMinor > 0 &&
        Number.isFinite(vAmount) &&
        vAmount > 0 &&
        Math.abs(vAmount - expectedMinor) > 5
      ) {
        throw new Error("Payment amount mismatch");
      }
      if (locked.paid_currency && vCurrency) {
        const oCur = String(locked.paid_currency).toUpperCase();
        if (oCur && vCurrency && oCur !== vCurrency) {
          throw new Error("Payment currency mismatch");
        }
      }

      await locked.update(
        {
          paymentStatus: "successful",
          orderStatus: "successful",
          payment_provider: locked.payment_provider || "paystack",
          ...(reference ? { paystackReferenceId: reference } : {}),
          notes: mergedNotes,
          ...(paid_amount != null ? { paid_amount } : {}),
          ...(vCurrency ? { paid_currency: vCurrency } : {}),
        },
        { transaction: t }
      );

      const items = await MarketplaceOrderItems.findAll({
        where: { marketplace_order_id: locked.id },
        include: [
          {
            model: MarketplaceProduct,
            attributes: ["id", "file"],
          },
        ],
        transaction: t,
        lock: { level: t.LOCK.UPDATE, of: MarketplaceOrderItems },
      });
      for (const item of items) {
        if (isRevokedValue(item.downloadUrl)) continue;
        const current =
          item.downloadUrl != null ? String(item.downloadUrl).trim() : "";
        if (current) continue;
        const productFile =
          item?.MarketplaceProduct?.file != null
            ? String(item.MarketplaceProduct.file).trim()
            : "";
        if (!productFile) continue;
        await item.update({ downloadUrl: productFile }, { transaction: t });
      }

      await fulfillOrderTransactional(locked.id, t);

      await writeSaleCreditsForOrder({ order: locked, transaction: t });

      await t.commit();

      await refreshProductSalesMaterializedView({ requestId });

      try {
        if (!alreadySuccessful) {
          const user = await User.findOne({ where: { id: locked.user_id } });
          const toEmail = firstString(
            verified?.customer?.email,
            verified?.metadata?.email,
            user?.email
          );
          if (toEmail) {
            const itemsFresh = await MarketplaceOrderItems.findAll({
              where: { marketplace_order_id: locked.id },
            });
            const products = (itemsFresh || []).map((it) => ({
              name: it.name,
              quantity: it.quantity,
              price: Number(it.price),
              subtotal: Number(it.subtotal),
            }));
            const html = await pretty(
              await render(
                <OrderConfirmationEmail
                  customerName={toEmail}
                  orderNumber={locked.order_number}
                  items={products}
                  subtotal={Number(locked.subtotal)}
                  discount={Number(locked.discount || 0)}
                  total={Number(locked.total)}
                />
              )
            );
            await sendEmail({
              to: toEmail,
              subject: `Your CrowdPen order ${locked.order_number} is confirmed`,
              html,
              text: `Order ${locked.order_number} confirmed. Total: ${locked.total}`,
            });
          }
        }
      } catch (e) {
        await reportError(e, {
          route: "/api/marketplace/paystack/webhook",
          method: "POST",
          status: 200,
          requestId,
          tag: "paystack_webhook_order_email",
          extra: { stage: "order_confirmation_email" },
        });
      }

      return NextResponse.json({
        status: "success",
        message: "Order fulfilled",
      });
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/paystack/webhook",
      method: "POST",
      status: 500,
      requestId,
      tag: "paystack_webhook_error",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Server error" : error?.message || "Server error",
      },
      { status: 500 }
    );
  }
}
