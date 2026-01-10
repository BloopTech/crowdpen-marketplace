import { NextResponse } from "next/server";
import crypto from "crypto";
import { Op } from "sequelize";
import { db } from "../../../../models";
import { render } from "@react-email/render";
import { sendEmail } from "../../../../lib/sendEmail";
import { OrderConfirmationEmail } from "../../../../lib/emails/OrderConfirmation";
import { PayoutReceiptEmail } from "../../../../lib/emails/PayoutReceipt";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { assertAnyEnvInProduction } from "../../../../lib/env";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

assertAnyEnvInProduction([
  "STARTBUTTON_WEBHOOK_SECRET",
  "STARTBUTTON_SECRET_KEY",
  "STARTBUTTON_SECRET",
  "STARTBUTTON_API_KEY",
]);

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
      const hex = crypto.createHmac(algo, secret).update(raw, "utf8").digest("hex");
      digests.push(hex);

      const b64 = crypto.createHmac(algo, secret).update(raw, "utf8").digest("base64");
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
  const joined = candidates.filter(Boolean).map((v) => String(v)).join(" |");
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
  const joined = candidates.filter(Boolean).map((v) => String(v)).join(" |");
  const s = joined.toLowerCase();

  if (s.includes("collection.completed") || s.includes("successful") || s.includes("completed")) {
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
  const joined = candidates.filter(Boolean).map((v) => String(v)).join(" |");
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
  const joined = candidates.filter(Boolean).map((v) => String(v)).join(" |");
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
    return NextResponse.json({ status: "error", message: "Webhook secret not configured" }, { status: 500 });
  }

  const ip = getClientIpFromHeaders(request.headers) || "unknown";
  const rl = rateLimit({ key: `sb-webhook:${ip}`, limit: 600, windowMs: 60_000 });
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
  const bearer = authz?.toLowerCase().startsWith("bearer ") ? authz.split(" ")[1] : null;
  const sig =
    request.headers.get("x-startbutton-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-signature");

  const sigOk = verifySignature(raw, sig, secret);
  const bearerOk = bearer && bearer === secret;

  if (!sigOk && !bearerOk) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ status: "success", message: "Transfer webhook received" });
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
      return NextResponse.json({ status: "success", message: "Transfer webhook received" });
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
      const becameCompleted = transferStatus === "completed" && current !== "completed";

      if (current !== transferStatus) {
        updates.status = transferStatus;
      }

      if (!lockedTx.transaction_reference && references[0]) {
        updates.transaction_reference = references[0];
      }

      if (!lockedTx.gateway_reference && (tx?.gatewayReference || tx?.gateway_reference)) {
        updates.gateway_reference = tx?.gatewayReference || tx?.gateway_reference;
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

      if (
        transferStatus === "completed" &&
        !lockedTx.completedAt
      ) {
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
            if (receiptRow && !receiptRow.sent_at && receiptRow.status !== "sending") {
              await receiptRow.update({ status: "sending" }, { transaction: t2 });
              claimed = true;
            }
            await t2.commit();
          } catch (e) {
            await t2.rollback();
            throw e;
          }

          if (claimed && receiptRow) {
            const txFresh = await MarketplaceAdminTransactions.findOne({ where: { id: payoutTx.id } });
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

            const currency = (txFresh?.currency || "USD").toString().toUpperCase();
            const amountMajor = Number(txFresh?.amount || 0) / 100;
            const paidAtUtc = fmtDateTimeUtc(txFresh?.completedAt || new Date());
            const settlementFrom = period?.settlementFrom ? String(period.settlementFrom) : null;
            const settlementTo = period?.settlementTo ? String(period.settlementTo) : null;
            const reference =
              txFresh?.transaction_reference ||
              txFresh?.gateway_reference ||
              txFresh?.transaction_id ||
              null;

            const merchantName = recipient?.name || null;
            const merchantEmail = receiptRow.to_email;

            const html = render(
              PayoutReceiptEmail({
                merchantName,
                merchantEmail,
                payoutId: payoutTx.id,
                amount: amountMajor,
                currency,
                paidAt: paidAtUtc,
                settlementFrom,
                settlementTo,
                reference,
              })
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
        }
      } catch (e) {
        console.error("payout receipt email error", e);
        try {
          await MarketplacePayoutReceipt.update(
            {
              status: "error",
              error: e?.message || "Failed to send receipt",
            },
            { where: { marketplace_admin_transaction_id: payoutTx.id, sent_at: null } }
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

      return NextResponse.json({ status: "success", message: "Payout transaction updated" });
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
        { status: "error", message: isProd ? "Server error" : (error?.message || "Server error") },
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
    order = await MarketplaceOrder.findOne({ where: { order_number: orderReference } });
  }
  if (!order) {
    return NextResponse.json({ status: "error", message: "Order not found" }, { status: 404 });
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
      const meta = extractMetadata(payload) || {};
      const paid_amount = toFiniteNumber(meta?.paidAmount) ?? toFiniteNumber(meta?.paid_amount);
      const fx_rate = toFiniteNumber(meta?.fxRate) ?? toFiniteNumber(meta?.fx_rate);
      const paid_currency = (meta?.paidCurrency || meta?.paid_currency || "")
        .toString()
        .trim()
        .toUpperCase();

      const nextOrderStatus = "successful";

      await lockedOrder.update(
        {
          paymentStatus: "successful",
          orderStatus: nextOrderStatus,
          paystackReferenceId:
            gatewayReference ||
            lockedOrder.paystackReferenceId ||
            orderReference ||
            null,
          notes: mergedNotes,
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
        const current = item.downloadUrl != null ? String(item.downloadUrl).trim() : "";
        if (current) continue;
        const productFile =
          item?.MarketplaceProduct?.file != null
            ? String(item.MarketplaceProduct.file).trim()
            : "";
        if (!productFile) continue;
        await item.update({ downloadUrl: productFile }, { transaction: t });
      }

      // Clear cart for this user
      const cart = await MarketplaceCart.findOne({
        where: { user_id: lockedOrder.user_id, active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (cart) {
        await MarketplaceCartItems.destroy({ where: { marketplace_cart_id: cart.id }, transaction: t });
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

      await t.commit();

      // Send email (best-effort)
      try {
        if (!alreadySuccessful) {
          const user = await User.findOne({ where: { id: lockedOrder.user_id } });
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
            const html = render(
              OrderConfirmationEmail({
                customerName: toEmail,
                orderNumber: lockedOrder.order_number,
                items: products,
                subtotal: Number(lockedOrder.subtotal),
                discount: Number(lockedOrder.discount || 0),
                total: Number(lockedOrder.total),
              })
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
        console.error("webhook email error", e);
      }

      return NextResponse.json({
        status: "success",
        message: stage === "completed" ? "Order marked as completed" : "Order marked as paid",
      });
    }

    if (ok && isVerified) {
      const nextOrderStatus =
        ["successful"].includes(String(lockedOrder.orderStatus || "").toLowerCase())
          ? "successful"
          : "processing";

      await lockedOrder.update(
        {
          orderStatus: nextOrderStatus,
          notes: mergedNotes,
        },
        { transaction: t }
      );

      await t.commit();
      return NextResponse.json({ status: "success", message: "Order marked as processing" });
    }

    if (failed) {
      await lockedOrder.update(
        {
          paymentStatus: "failed",
          orderStatus: "failed",
          notes: mergedNotes,
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
      return NextResponse.json({ status: "success", message: "Order marked as failed" });
    }

    // Unrecognized status; accept to avoid retries if desired
    await lockedOrder.update(
      {
        notes: mergedNotes,
      },
      { transaction: t }
    );
    await t.commit();
    return NextResponse.json({ status: "success", message: "Webhook received" });
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
      { status: "error", message: isProd ? "Server error" : (error?.message || "Server error") },
      { status: 500 }
    );
  }
}
