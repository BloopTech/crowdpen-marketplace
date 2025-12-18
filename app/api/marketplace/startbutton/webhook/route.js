import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "../../../../models";
import { render } from "@react-email/render";
import { sendEmail } from "../../../../lib/sendEmail";
import { OrderConfirmationEmail } from "../../../../lib/emails/OrderConfirmation";

const {
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceCart,
  MarketplaceCartItems,
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

function verifySignature(raw, headerSig, secret) {
  if (!headerSig || !secret) return false;
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(raw, "utf8");
    const digest = hmac.digest("hex");
    // Support possible prefixed signatures like "sha256=..."
    const normalizedHeader = String(headerSig).toLowerCase().replace(/^sha256=/, "");
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(normalizedHeader));
  } catch {
    return false;
  }
}

function isPaymentSuccess(payload) {
  const p = payload || {};
  const status = p.status || p.event || p.type || p?.data?.status || "";
  const s = String(status).toLowerCase();
  if (["success", "paid", "completed", "charge.success", "payment.success"].some((k) => s.includes(k))) return true;
  return false;
}

function isPaymentFailed(payload) {
  const p = payload || {};
  const status = p.status || p.event || p.type || p?.data?.status || "";
  const s = String(status).toLowerCase();
  if (["failed", "error", "cancelled", "declined", "payment.failed"].some((k) => s.includes(k))) return true;
  return false;
}

function extractReference(payload) {
  return (
    payload?.reference ||
    payload?.data?.reference ||
    payload?.txRef ||
    payload?.ref ||
    null
  );
}

function extractOrderId(payload) {
  return (
    payload?.metadata?.orderId ||
    payload?.data?.metadata?.orderId ||
    null
  );
}

function extractPayerEmail(payload) {
  return (
    payload?.customer?.email ||
    payload?.data?.customer?.email ||
    null
  );
}

function extractMetadata(payload) {
  return payload?.metadata || payload?.data?.metadata || null;
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

  // Identify order
  const orderId = extractOrderId(payload);
  const reference = extractReference(payload);

  let order = null;
  if (orderId) {
    order = await MarketplaceOrder.findOne({ where: { id: orderId } });
  }
  if (!order && reference) {
    order = await MarketplaceOrder.findOne({ where: { order_number: reference } });
  }
  if (!order) {
    return NextResponse.json({ status: "error", message: "Order not found" }, { status: 404 });
  }

  const t = await sequelize.transaction();
  try {
    const notesPart = raw ? `Webhook: ${raw}` : null;
    const mergedNotes = notesPart ? (order.notes ? `${order.notes}\n${notesPart}` : notesPart) : order.notes;

    if (ok) {
      const meta = extractMetadata(payload) || {};
      const paid_amount = toFiniteNumber(meta?.paidAmount) ?? toFiniteNumber(meta?.paid_amount);
      const fx_rate = toFiniteNumber(meta?.fxRate) ?? toFiniteNumber(meta?.fx_rate);
      const paid_currency = (meta?.paidCurrency || meta?.paid_currency || "")
        .toString()
        .trim()
        .toUpperCase();

      await order.update(
        {
          paymentStatus: "successful",
          orderStatus: "successful",
          paystackReferenceId: reference || order.paystackReferenceId,
          notes: mergedNotes,
          ...(paid_amount != null ? { paid_amount } : {}),
          ...(paid_currency ? { paid_currency } : {}),
          ...(fx_rate != null ? { fx_rate } : {}),
        },
        { transaction: t }
      );

      // Clear cart for this user
      const cart = await MarketplaceCart.findOne({ where: { user_id: order.user_id, active: true }, transaction: t, lock: t.LOCK.UPDATE });
      if (cart) {
        await MarketplaceCartItems.destroy({ where: { marketplace_cart_id: cart.id }, transaction: t });
        await cart.update({ subtotal: 0, tax: 0, discount: 0, total: 0 }, { transaction: t });
      }

      await t.commit();

      // Send email (best-effort)
      try {
        const user = await User.findOne({ where: { id: order.user_id } });
        const toEmail = extractPayerEmail(payload) || user?.email;
        if (toEmail) {
          const items = await MarketplaceOrderItems.findAll({ where: { marketplace_order_id: order.id } });
          const products = items.map((it) => ({ name: it.name, quantity: it.quantity, price: Number(it.price), subtotal: Number(it.subtotal) }));
          const html = render(
            OrderConfirmationEmail({
              customerName: toEmail,
              orderNumber: order.order_number,
              items: products,
              subtotal: Number(order.subtotal),
              tax: Number(order.tax || 0),
              discount: Number(order.discount || 0),
              total: Number(order.total),
            })
          );
          await sendEmail({ to: toEmail, subject: `Your CrowdPen order ${order.order_number} is confirmed`, html, text: `Order ${order.order_number} confirmed. Total: ${order.total}` });
        }
      } catch (e) {
        console.error("webhook email error", e);
      }

      return NextResponse.json({ status: "success", message: "Order marked as completed" });
    }

    if (failed) {
      await order.update(
        {
          paymentStatus: "failed",
          orderStatus: "pending",
          notes: mergedNotes,
        },
        { transaction: t }
      );
      await t.commit();
      return NextResponse.json({ status: "success", message: "Order marked as failed" });
    }

    // Unrecognized status; accept to avoid retries if desired
    await order.update(
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
    return NextResponse.json({ status: "error", message: error?.message || "Server error" }, { status: 500 });
  }
}
