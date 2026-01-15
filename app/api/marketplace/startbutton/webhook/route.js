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

function getWebhookSecret() {
  return (
    process.env.STARTBUTTON_WEBHOOK_SECRET ||
    process.env.STARTBUTTON_SECRET_KEY ||
    process.env.STARTBUTTON_SECRET ||
    process.env.STARTBUTTON_API_KEY ||
    ""
  );
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const INVENTORY_RESERVED_MARKER = "inventory=reserved";
const INVENTORY_DECREMENTED_MARKER = "inventory=decremented";
const INVENTORY_RELEASED_MARKER = "inventory=released";

function hasInventoryMarker(notes, marker) {
  const s = notes != null ? String(notes) : "";
  return s.includes(marker);
}

function appendInventoryMarker(notes, marker) {
  const s = notes != null ? String(notes) : "";
  if (s.includes(marker)) return s;
  return s ? `${s}\n${marker}` : marker;
}

async function adjustStockForOrder({ orderId, transaction, direction }) {
  if (!orderId) return;
  const dir = Number(direction);
  if (dir !== 1 && dir !== -1) return;

  const items = await MarketplaceOrderItems.findAll({
    where: { marketplace_order_id: orderId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  for (const it of items) {
    const product = await MarketplaceProduct.findByPk(it.marketplace_product_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!product || product.stock === null || typeof product.stock === "undefined") {
      continue;
    }

    const current = Number(product.stock);
    const qty = Number(it.quantity);
    if (!Number.isFinite(current) || !Number.isFinite(qty) || qty <= 0) continue;

    const next = current + dir * qty;
    if (dir === -1 && next < 0) {
      throw new Error(`Insufficient stock for ${product.title}`);
    }

    const newStock = Math.max(0, next);
    await product.update(
      { stock: newStock, inStock: newStock > 0 },
      { transaction }
    );
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
    if (msg.toLowerCase().includes("refresh") && msg.toLowerCase().includes("concurrently") && msg.toLowerCase().includes("transaction")) {
      return;
    }
    await reportError(e, {
      route: "/api/marketplace/startbutton/webhook",
      method: "POST",
      status: 200,
      requestId,
      tag: "startbutton_webhook_refresh_mv_product_sales",
    });
  }
}

async function writeSaleCreditsForOrder({ order, transaction, gatewayReference }) {
  const orderId = order?.id;
  if (!orderId) return;

  const { crowdpenPct: crowdPct, startbuttonPct: sbPct } =
    await getMarketplaceFeePercents({ db });

  const currency = String(order?.currency || order?.paid_currency || "USD")
    .trim()
    .toUpperCase();
  const paymentProvider = String(order?.payment_provider || "startbutton").trim();
  const orderNumber = order?.order_number ? String(order.order_number).trim() : null;
  const startbuttonReferenceId = firstString(
    gatewayReference,
    order?.startbuttonReferenceId
  );
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
          'startbutton_reference', :startbuttonReferenceId,
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
        startbuttonReferenceId,
        earnedAt,
        crowdPct: Number(crowdPct || 0),
        sbPct: Number(sbPct || 0),
      },
      transaction,
      type: db.Sequelize.QueryTypes.INSERT,
    }
  );
}

function looksLikeHexDigest(value) {
  const s = String(value || "").trim();
  return /^[0-9a-fA-F]+$/.test(s) && (s.length === 64 || s.length === 128);
}

function normalizeSignatureValue(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const match = s.match(/^(sha256|sha512)\s*=\s*(.+)$/i);
  const raw = (match ? match[2] : s).trim();
  return looksLikeHexDigest(raw) ? raw.toLowerCase() : raw;
}

function safeTimingEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifySignature(raw, headerSig, secret) {
  if (!headerSig || !secret) return false;

  try {
    const headerParts = String(headerSig)
      .split(",")
      .map((p) => normalizeSignatureValue(p))
      .filter(Boolean);
    if (!headerParts.length) return false;

    const digests = [];
    for (const algo of ["sha512", "sha256"]) {
      const hex = crypto
        .createHmac(algo, secret)
        .update(raw, "utf8")
        .digest("hex");
      digests.push(hex);

      const b64 = crypto
        .createHmac(algo, secret)
        .update(raw, "utf8")
        .digest("base64");
      digests.push(b64);
      digests.push(b64.replace(/=+$/, ""));
    }

    for (const headerVal of headerParts) {
      const normalizedHeader = normalizeSignatureValue(headerVal);
      for (const digest of digests) {
        const normalizedDigest = normalizeSignatureValue(digest);
        if (safeTimingEqual(normalizedDigest, normalizedHeader)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function isPaymentSuccess(payload) {
  const p = payload || {};
  const candidates = [
    p.status,
    p.event,
    p.type,
    p?.data?.status,
    p?.data?.transaction?.status,
    p?.data?.transaction?.transactionStatus,
    p?.data?.transaction_status,
  ];
  const joined = candidates
    .filter(Boolean)
    .map((v) => String(v))
    .join(" |");
  const s = joined.toLowerCase();
  return [
    "success",
    "paid",
    "completed",
    "verified",
    "charge.success",
    "payment.success",
  ].some((k) => s.includes(k));
}

function getCollectionStage(payload) {
  const p = payload || {};
  const candidates = [
    p.event,
    p.type,
    p.status,
    p?.data?.status,
    p?.data?.transaction?.status,
    p?.data?.transaction?.transactionStatus,
    p?.data?.transaction_status,
  ];
  const joined = candidates
    .filter(Boolean)
    .map((v) => String(v))
    .join(" |");
  const s = joined.toLowerCase();

  if (
    s.includes("collection.completed") ||
    s.includes("successful") ||
    s.includes("completed")
  ) {
    return "completed";
  }
  if (s.includes("collection.verified") || s.includes("verified")) {
    return "verified";
  }
  return null;
}

function isPaymentFailed(payload) {
  const p = payload || {};
  const candidates = [
    p.status,
    p.event,
    p.type,
    p?.data?.status,
    p?.data?.transaction?.status,
    p?.data?.transaction?.transactionStatus,
    p?.data?.transaction_status,
  ];
  const joined = candidates
    .filter(Boolean)
    .map((v) => String(v))
    .join(" |");
  const s = joined.toLowerCase();
  return [
    "failed",
    "error",
    "cancelled",
    "canceled",
    "declined",
    "payment.failed",
  ].some((k) => s.includes(k));
}

function firstString(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function extractOrderReference(payload) {
  return firstString(
    payload?.userTransactionReference,
    payload?.data?.userTransactionReference,
    payload?.data?.user_transaction_reference,
    payload?.data?.transaction?.userTransactionReference,
    payload?.data?.transaction?.user_transaction_reference,
    payload?.reference,
    payload?.data?.reference,
    payload?.metadata?.reference,
    payload?.data?.metadata?.reference,
    payload?.data?.transaction?.metadata?.reference,
    payload?.txRef,
    payload?.ref
  );
}

function extractGatewayReference(payload) {
  return firstString(
    payload?.transactionReference,
    payload?.data?.transactionReference,
    payload?.data?.transaction_reference,
    payload?.data?.transaction?.transactionReference,
    payload?.data?.transaction?.transaction_reference,
    payload?.data?.transaction?.gatewayReference,
    payload?.data?.transaction?.gateway_reference,
    payload?.data?.transaction?.reference,
    payload?.data?.transaction?._id,
    payload?.data?.transaction?.id,
    payload?.data?.transactionId,
    payload?.transactionId
  );
}

function extractOrderId(payload) {
  return (
    payload?.metadata?.orderId ||
    payload?.data?.metadata?.orderId ||
    payload?.data?.transaction?.metadata?.orderId ||
    null
  );
}

function extractPayerEmail(payload) {
  return (
    payload?.customer?.email ||
    payload?.data?.customer?.email ||
    payload?.data?.transaction?.customerEmail ||
    payload?.data?.transaction?.customer_email ||
    null
  );
}

function extractMetadata(payload) {
  return (
    payload?.metadata ||
    payload?.data?.metadata ||
    payload?.data?.transaction?.metadata ||
    null
  );
}

function extractTransactionType(payload) {
  return firstString(
    payload?.data?.transaction?.transType,
    payload?.data?.transaction?.trans_type,
    payload?.data?.transType,
    payload?.data?.trans_type,
    payload?.transType,
    payload?.trans_type
  );
}

function looksLikeTransferEvent(payload) {
  const p = payload || {};
  const transType = (extractTransactionType(p) || "").toString().toLowerCase();
  if (transType === "transfer") return true;
  const s = String(p?.event || p?.type || "").toLowerCase();
  return s.includes("transfer.");
}

function mapTransferStatus(payload) {
  const p = payload || {};
  const candidates = [
    p?.data?.transaction?.status,
    p?.status,
    p?.data?.status,
    p?.event,
    p?.type,
  ];
  const joined = candidates
    .filter(Boolean)
    .map((v) => String(v))
    .join(" |");
  const s = joined.toLowerCase();

  if (s.includes("failed")) return "failed";
  if (s.includes("reversed")) return "reversed";
  if (s.includes("cancelled") || s.includes("canceled")) return "cancelled";
  if (s.includes("successful") || s.includes("success")) return "completed";
  if (s.includes("pending") || s.includes("initiated")) return "pending";
  return null;
}

function isRevokedValue(value) {
  const s = value != null ? String(value).trim() : "";
  return s.toUpperCase() === "REVOKED";
}

function toFiniteNumber(v) {
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function POST(request) {
  const requestId = getRequestIdFromHeaders(request.headers) || null;
  const secret = getWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { status: "error", message: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const ip = getClientIpFromHeaders(request.headers) || "unknown";
  const rl = rateLimit({
    key: `sb-webhook:${ip}`,
    limit: 600,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { status: "error", message: "Too many requests" },
      { status: 429, headers: rateLimitResponseHeaders(rl) }
    );
  }

  // Read raw body for signature verification
  const raw = await request.text();
  const payload = safeJsonParse(raw) || {};

  const authz = request.headers.get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ")
    ? authz.split(" ")[1]
    : null;
  const sig =
    request.headers.get("x-startbutton-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-signature");

  const sigOk = verifySignature(raw, sig, secret);
  const bearerOk = bearer && bearer === secret;

  if (!sigOk && !bearerOk) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const isTransfer = looksLikeTransferEvent(payload);
  const ok = !isTransfer && isPaymentSuccess(payload);
  const failed = !isTransfer && isPaymentFailed(payload);
  const stage = !isTransfer ? getCollectionStage(payload) : null;

  if (isTransfer) {
    const tx = payload?.data?.transaction || {};
    const transferStatus = mapTransferStatus(payload);
    const referenceCandidates = [
      tx?.userTransactionReference,
      tx?.user_transaction_reference,
      tx?.transactionReference,
      tx?.transaction_reference,
      tx?.gatewayReference,
      tx?.gateway_reference,
      tx?._id,
      tx?.id,
    ]
      .filter(Boolean)
      .map((v) => String(v).trim())
      .filter(Boolean);
    const references = Array.from(new Set(referenceCandidates));

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
      const updates = {};

      const statusChanged = current !== transferStatus;
      const becameCompleted =
        transferStatus === "completed" && current !== "completed";

      if (current !== transferStatus) {
        updates.status = transferStatus;
      }

      if (!lockedTx.transaction_reference && references[0]) {
        updates.transaction_reference = references[0];
      }

      if (
        !lockedTx.gateway_reference &&
        (tx?.gatewayReference || tx?.gateway_reference)
      ) {
        updates.gateway_reference =
          tx?.gatewayReference || tx?.gateway_reference;
      }

      if (tx?.merchantId && !lockedTx.merchant_id) {
        updates.merchant_id = tx?.merchantId;
      }

      if (tx?.feeAmount != null && lockedTx.fee_amount == null) {
        updates.fee_amount = tx?.feeAmount;
      }

      if (tx?.amount != null && lockedTx.amount == null) {
        updates.amount = tx?.amount;
      }

      if (tx?.currency && !lockedTx.currency) {
        updates.currency = String(tx.currency).toUpperCase();
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
            actor_type: "startbutton_webhook",
            actor_user_id: null,
            metadata: {
              references,
              event: payload?.event || payload?.type || null,
            },
          },
          { transaction: t }
        );
      }

      // Queue receipt (idempotent) if payout became completed.
      if (becameCompleted) {
        const recipient = await User.findOne({
          where: { id: lockedTx.recipient_id },
          transaction: t,
        });
        const toEmail = recipient?.email ? String(recipient.email).trim() : "";
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

      // Send receipt after commit (best-effort), with idempotent claim.
      try {
        if (becameCompleted) {
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

            const html = await pretty(await render(
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
            ));

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
        }
      } catch (e) {
        await reportError(e, {
          route: "/api/marketplace/startbutton/webhook",
          method: "POST",
          status: 200,
          requestId,
          tag: "startbutton_webhook_payout_receipt_email",
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

      return NextResponse.json({
        status: "success",
        message: "Payout transaction updated",
      });
    } catch (error) {
      await t.rollback();
      await reportError(error, {
        route: "/api/marketplace/startbutton/webhook",
        method: "POST",
        status: 500,
        requestId,
        tag: "startbutton_webhook_transfer",
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

  // Identify order
  const orderId = extractOrderId(payload);
  const orderReference = extractOrderReference(payload);
  const gatewayReference = extractGatewayReference(payload);

  let order = null;
  if (orderId) {
    order = await MarketplaceOrder.findOne({ where: { id: orderId } });
  }
  if (!order && orderReference) {
    order = await MarketplaceOrder.findOne({
      where: { order_number: orderReference },
    });
  }
  if (!order) {
    return NextResponse.json(
      { status: "error", message: "Order not found" },
      { status: 404 }
    );
  }

  const t = await sequelize.transaction();
  try {
    const lockedOrder = await MarketplaceOrder.findOne({
      where: { id: order.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!lockedOrder) {
      throw new Error("Order not found");
    }

    const notesPart = `Webhook received: ${new Date().toISOString()}${orderReference ? ` orderRef=${orderReference}` : ""}${gatewayReference ? ` gatewayRef=${gatewayReference}` : ""}${stage ? ` stage=${stage}` : ""}${ok ? " paid" : failed ? " failed" : ""}`;
    const mergedNotes = notesPart
      ? lockedOrder.notes
        ? lockedOrder.notes.includes(notesPart)
          ? lockedOrder.notes
          : `${lockedOrder.notes}\n${notesPart}`
        : notesPart
      : lockedOrder.notes;

    const alreadySuccessful =
      String(lockedOrder.paymentStatus || "").toLowerCase() === "successful" ||
      String(lockedOrder.orderStatus || "").toLowerCase() === "successful";

    const isSettled = stage === "completed";
    const isVerified = stage === "verified";

    if (ok && isSettled) {
      const hasReserved = hasInventoryMarker(mergedNotes, INVENTORY_RESERVED_MARKER);
      const hasDecremented = hasInventoryMarker(
        mergedNotes,
        INVENTORY_DECREMENTED_MARKER
      );
      const shouldAdjustStock = !alreadySuccessful && !hasDecremented;

      const meta = extractMetadata(payload) || {};
      const paid_amount =
        toFiniteNumber(meta?.paidAmount) ?? toFiniteNumber(meta?.paid_amount);
      const fx_rate =
        toFiniteNumber(meta?.fxRate) ?? toFiniteNumber(meta?.fx_rate);
      const paid_currency = (meta?.paidCurrency || meta?.paid_currency || "")
        .toString()
        .trim()
        .toUpperCase();

      const nextOrderStatus = "successful";

      const notesForUpdate = shouldAdjustStock
        ? appendInventoryMarker(mergedNotes, INVENTORY_DECREMENTED_MARKER)
        : mergedNotes;

      await lockedOrder.update(
        {
          paymentStatus: "successful",
          orderStatus: nextOrderStatus,
          payment_provider: lockedOrder.payment_provider || "startbutton",
          startbuttonReferenceId:
            gatewayReference ||
            lockedOrder.startbuttonReferenceId ||
            orderReference ||
            null,
          notes: notesForUpdate,
          ...(paid_amount != null ? { paid_amount } : {}),
          ...(paid_currency ? { paid_currency } : {}),
          ...(fx_rate != null ? { fx_rate } : {}),
        },
        { transaction: t }
      );

      const items = await MarketplaceOrderItems.findAll({
        where: { marketplace_order_id: lockedOrder.id },
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

      if (shouldAdjustStock && !hasReserved) {
        await adjustStockForOrder({
          orderId: lockedOrder.id,
          transaction: t,
          direction: -1,
        });
      }

      // Clear cart for this user
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

      await writeSaleCreditsForOrder({
        order: lockedOrder,
        transaction: t,
        gatewayReference,
      });

      await t.commit();

      await refreshProductSalesMaterializedView({ requestId });

      // Send email (best-effort)
      try {
        if (!alreadySuccessful) {
          const user = await User.findOne({
            where: { id: lockedOrder.user_id },
          });
          const toEmail = extractPayerEmail(payload) || user?.email;
          if (toEmail) {
            const items = await MarketplaceOrderItems.findAll({
              where: { marketplace_order_id: lockedOrder.id },
            });
            const products = items.map((it) => ({
              name: it.name,
              quantity: it.quantity,
              price: Number(it.price),
              subtotal: Number(it.subtotal),
            }));
            const html = await pretty(
              await render(
                <OrderConfirmationEmail
                  customerName={toEmail}
                  orderNumber={lockedOrder.order_number}
                  items={products}
                  subtotal={Number(lockedOrder.subtotal)}
                  discount={Number(lockedOrder.discount || 0)}
                  total={Number(lockedOrder.total)}
                />
              )
            );
            await sendEmail({
              to: toEmail,
              subject: `Your CrowdPen order ${lockedOrder.order_number} is confirmed`,
              html,
              text: `Order ${lockedOrder.order_number} confirmed. Total: ${lockedOrder.total}`,
            });
          }
        }
      } catch (e) {
        await reportError(e, {
          route: "/api/marketplace/startbutton/webhook",
          method: "POST",
          status: 200,
          requestId,
          tag: "startbutton_webhook_order_email",
          extra: { stage: "order_confirmation_email" },
        });
      }

      return NextResponse.json({
        status: "success",
        message:
          stage === "completed"
            ? "Order marked as completed"
            : "Order marked as paid",
      });
    }

    if (ok && isVerified) {
      const hasReserved = hasInventoryMarker(mergedNotes, INVENTORY_RESERVED_MARKER);
      const hasDecremented = hasInventoryMarker(
        mergedNotes,
        INVENTORY_DECREMENTED_MARKER
      );
      const shouldReserve = !alreadySuccessful && !hasReserved && !hasDecremented;

      const nextOrderStatus = ["successful"].includes(
        String(lockedOrder.orderStatus || "").toLowerCase()
      )
        ? "successful"
        : "processing";

      if (shouldReserve) {
        await adjustStockForOrder({
          orderId: lockedOrder.id,
          transaction: t,
          direction: -1,
        });
      }

      const notesForUpdate = shouldReserve
        ? appendInventoryMarker(mergedNotes, INVENTORY_RESERVED_MARKER)
        : mergedNotes;

      await lockedOrder.update(
        {
          orderStatus: nextOrderStatus,
          notes: notesForUpdate,
        },
        { transaction: t }
      );

      await t.commit();
      return NextResponse.json({
        status: "success",
        message: "Order marked as processing",
      });
    }

    if (failed) {
      const hasReserved = hasInventoryMarker(mergedNotes, INVENTORY_RESERVED_MARKER);
      const hasDecremented = hasInventoryMarker(
        mergedNotes,
        INVENTORY_DECREMENTED_MARKER
      );
      const hasReleased = hasInventoryMarker(mergedNotes, INVENTORY_RELEASED_MARKER);
      const shouldRelease =
        !alreadySuccessful && hasReserved && !hasDecremented && !hasReleased;

      if (shouldRelease) {
        await adjustStockForOrder({
          orderId: lockedOrder.id,
          transaction: t,
          direction: 1,
        });
      }

      const notesForUpdate = shouldRelease
        ? appendInventoryMarker(mergedNotes, INVENTORY_RELEASED_MARKER)
        : mergedNotes;

      await lockedOrder.update(
        {
          paymentStatus: "failed",
          orderStatus: "failed",
          notes: notesForUpdate,
        },
        { transaction: t }
      );

      const redemption = await MarketplaceCouponRedemption.findOne({
        where: { order_id: lockedOrder.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (redemption && redemption.status === "pending") {
        await redemption.update({ status: "failed" }, { transaction: t });
      }

      await t.commit();
      return NextResponse.json({
        status: "success",
        message: "Order marked as failed",
      });
    }

    // Unrecognized status; accept to avoid retries if desired
    await lockedOrder.update(
      {
        notes: mergedNotes,
      },
      { transaction: t }
    );
    await t.commit();
    return NextResponse.json({
      status: "success",
      message: "Webhook received",
    });
  } catch (error) {
    await t.rollback();
    await reportError(error, {
      route: "/api/marketplace/startbutton/webhook",
      method: "POST",
      status: 500,
      requestId,
      tag: "startbutton_webhook",
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
