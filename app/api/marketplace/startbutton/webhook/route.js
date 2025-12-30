import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "../../../../models";
import { render } from "@react-email/render";
import { sendEmail } from "../../../../lib/sendEmail";
import { OrderConfirmationEmail } from "../../../../lib/emails/OrderConfirmation";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { assertAnyEnvInProduction } from "../../../../lib/env";

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
  User,
  sequelize,
} = db;

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

function isRevokedValue(value) {
  const s = value != null ? String(value).trim() : "";
  return s.toUpperCase() === "REVOKED";
}

function toFiniteNumber(v) {
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function POST(request) {
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

  const ok = isPaymentSuccess(payload);
  const failed = isPaymentFailed(payload);
  const stage = getCollectionStage(payload);

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

    if (ok) {
      const meta = extractMetadata(payload) || {};
      const paid_amount = toFiniteNumber(meta?.paidAmount) ?? toFiniteNumber(meta?.paid_amount);
      const fx_rate = toFiniteNumber(meta?.fxRate) ?? toFiniteNumber(meta?.fx_rate);
      const paid_currency = (meta?.paidCurrency || meta?.paid_currency || "")
        .toString()
        .trim()
        .toUpperCase();

      const nextOrderStatus =
        stage === "completed"
          ? "successful"
          : String(lockedOrder.orderStatus || "").toLowerCase() === "successful"
            ? "successful"
            : "processing";

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
        lock: t.LOCK.UPDATE,
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
        await cart.update({ subtotal: 0, tax: 0, discount: 0, total: 0 }, { transaction: t });
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
                tax: Number(lockedOrder.tax || 0),
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

    if (failed) {
      await lockedOrder.update(
        {
          paymentStatus: "failed",
          orderStatus: "failed",
          notes: mergedNotes,
        },
        { transaction: t }
      );
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
    console.error("startbutton webhook error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Server error" : (error?.message || "Server error") },
      { status: 500 }
    );
  }
}
