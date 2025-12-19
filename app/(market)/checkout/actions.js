"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { headers } from "next/headers";
import { db } from "../../models";
import { revalidatePath } from "next/cache";
import { render } from "@react-email/render";
import { sendEmail } from "../../lib/sendEmail";
import { OrderConfirmationEmail } from "../../lib/emails/OrderConfirmation";

const {
  User,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceAddress,
  sequelize,
} = db;

function normalizeCurrency(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

function getStartButtonSupportedCurrencies() {
  const raw = process.env.STARTBUTTON_SUPPORTED_CURRENCIES;
  if (raw) {
    const set = new Set(
      raw
        .split(",")
        .map((s) => normalizeCurrency(s))
        .filter(Boolean)
    );
    if (set.size > 0) return set;
  }

  // Default allowlist based on existing app usage.
  return new Set(["NGN", "GHS", "ZAR", "KES", "UGX", "RWF", "TZS", "ZMW", "XOF", "USD"]);
}

function generateOrderNumber() {
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = ts.getFullYear();
  const m = pad(ts.getMonth() + 1);
  const d = pad(ts.getDate());
  const hh = pad(ts.getHours());
  const mm = pad(ts.getMinutes());
  const ss = pad(ts.getSeconds());
  return `CP-${y}${m}${d}-${hh}${mm}${ss}-${Math.floor(Math.random() * 1000)}`;
}

async function getHeaderCountry() {
  try {
    const h = await headers();
    const vercel = h.get("x-vercel-ip-country");
    const cf = h.get("cf-ipcountry");
    const generic = h.get("x-country-code");
    const code = (vercel || cf || generic || "").toUpperCase();
    return code || null;
  } catch {
    return null;
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMetadata(payload) {
  return payload?.metadata || payload?.data?.metadata || null;
}

function toFiniteNumber(v) {
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function deriveCurrencyByCountry(countryCode) {
  const c = (countryCode || "").toUpperCase();

  const euroCountries = new Set([
    "AT",
    "BE",
    "CY",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PT",
    "SK",
    "SI",
    "ES",
  ]);
  if (euroCountries.has(c)) return "EUR";

  const map = {
    US: "USD",
    GB: "GBP",
    CA: "CAD",
    AU: "AUD",
    NZ: "NZD",
    CH: "CHF",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    PL: "PLN",
    CZ: "CZK",
    HU: "HUF",
    RO: "RON",
    BG: "BGN",

    NG: "NGN",
    GH: "GHS",
    ZA: "ZAR",
    KE: "KES",
    UG: "UGX",
    RW: "RWF",
    TZ: "TZS",
    ZM: "ZMW",

    CI: "XOF",
    BJ: "XOF",
    TG: "XOF",
    SN: "XOF",
    ML: "XOF",
    BF: "XOF",

    JP: "JPY",
    CN: "CNY",
    IN: "INR",
    SG: "SGD",
    HK: "HKD",
    KR: "KRW",

    BR: "BRL",
    MX: "MXN",

    EG: "EGP",
    MA: "MAD",
  };

  return map[c] || "USD";
}

async function getFxRate(from, to) {
  if (!from || !to || from === to) return 1;
  try {
    const upstream = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      next: { revalidate: 3600 },
    });
    if (!upstream.ok) return null;
    const data = await upstream.json().catch(() => null);
    const rateRaw = data?.rates?.[to];
    const rate = rateRaw != null ? Number(rateRaw) : null;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export async function beginCheckout(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Authentication required",
      errors: { auth: ["Please log in"] },
    };
  }

  const userId = session.user.id;
  const email = (formData.get("email") || "").toString().trim();
  const firstName = (formData.get("firstName") || "").toString().trim();
  const lastName = (formData.get("lastName") || "").toString().trim();
  const billingAddress = (formData.get("billingAddress") || "")
    .toString()
    .trim();
  const city = (formData.get("city") || "").toString().trim();
  const zipCode = (formData.get("zipCode") || "").toString().trim();
  const country = (formData.get("country") || "").toString().trim() || "NG";
  const paymentMethod = (
    formData.get("paymentMethod") || "startbutton"
  ).toString();

  if (
    !email ||
    !firstName ||
    !lastName ||
    !billingAddress ||
    !city ||
    !zipCode
  ) {
    return {
      success: false,
      message: "Please complete all required fields.",
      errors: { form: ["Missing required fields"] },
    };
  }

  // Find active cart
  const cart = await MarketplaceCart.findOne({
    where: { user_id: userId, active: true },
  });
  if (!cart) {
    return {
      success: false,
      message: "Your cart is empty.",
      errors: { cart: ["No active cart"] },
    };
  }

  // Fetch cart items with product title for order item naming
  const cartItems = await MarketplaceCartItems.findAll({
    where: { marketplace_cart_id: cart.id },
    include: [
      {
        model: db.MarketplaceProduct,
        attributes: [
          "id",
          "title",
          "user_id",
          "stock",
          "inStock",
          "currency",
          "file",
          "fileType",
        ],
        include: [
          {
            model: db.User,
            attributes: ["id"],
            include: [
              { model: db.MarketplaceKycVerification, attributes: ["status"], required: false },
            ],
          },
        ],
      },
    ],
  });
  if (!cartItems.length) {
    return {
      success: false,
      message: "Your cart is empty.",
      errors: { cart: ["No items in cart"] },
    };
  }

  // KYC gating: disallow checkout if any item is from an owner whose KYC is not approved (unless item owner is the viewer)
  const kycBlocked = cartItems.filter((ci) => {
    const p = ci?.MarketplaceProduct;
    if (!p) return false;
    const isOwner = p.user_id === userId;
    const ownerApproved = p?.User?.MarketplaceKycVerification?.status === 'approved';
    return !isOwner && !ownerApproved;
  });
  if (kycBlocked.length > 0) {
    const titles = kycBlocked.map((ci) => ci?.MarketplaceProduct?.title).filter(Boolean);
    return {
      success: false,
      message: `Some items are not available for purchase: ${titles.join(", ")}`,
      errors: { cart: ["Contains items from unapproved sellers"] },
    };
  }

  // Stock gating: disallow checkout if any item is out of stock or exceeds available stock
  const stockIssues = cartItems.filter((ci) => {
    const p = ci?.MarketplaceProduct;
    if (!p) return false;
    const out = (p?.inStock === false) || (p?.stock !== null && typeof p?.stock !== 'undefined' && Number(p.stock) <= 0);
    const exceeds = (p?.stock !== null && typeof p?.stock !== 'undefined' && Number(ci.quantity) > Number(p.stock));
    return out || exceeds;
  });
  if (stockIssues.length > 0) {
    const titles = stockIssues.map((ci) => ci?.MarketplaceProduct?.title).filter(Boolean);
    return {
      success: false,
      message: `Some items are out of stock or exceed available quantity: ${titles.join(", ")}`,
      errors: { cart: ["Insufficient stock"] },
    };
  }

  // Compute totals from cart
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price),
    0
  );
  const tax = Number(cart.tax ?? 0);
  const discount = Number(cart.discount ?? 0);
  const total = subtotal + tax - discount;

  const baseCurrency = "USD";
  const ipCountry = await getHeaderCountry();
  const supported = getStartButtonSupportedCurrencies();
  const viewerCurrency = normalizeCurrency(deriveCurrencyByCountry(ipCountry)) || baseCurrency;

  // Choose a charge currency that StartButton supports and for which we have an FX rate.
  const candidates = Array.from(
    new Set([viewerCurrency, baseCurrency, "GHS"].map((c) => normalizeCurrency(c)).filter(Boolean))
  );

  let paidCurrency = baseCurrency;
  let fxRate = 1;
  for (const cur of candidates) {
    if (!supported.has(cur)) continue;
    if (cur === baseCurrency) {
      paidCurrency = baseCurrency;
      fxRate = 1;
      break;
    }

    const rate = await getFxRate(baseCurrency, cur);
    if (rate != null) {
      paidCurrency = cur;
      fxRate = rate;
      break;
    }
  }

  const paidAmount = Number((Number(total) * Number(fxRate)).toFixed(2));

  const t = await sequelize.transaction();
  try {
    // Create or reuse a simple billing address record
    const address = await MarketplaceAddress.create(
      {
        user_id: userId,
        name: `${firstName} ${lastName}`.trim(),
        addressLine1: billingAddress,
        addressLine2: "",
        city,
        state: "",
        postalCode: zipCode,
        country,
        phone: "",
        isDefault: false,
        type: "billing",
      },
      { transaction: t }
    );

    const orderNumber = generateOrderNumber();
    const order = await MarketplaceOrder.create(
      {
        user_id: userId,
        order_number: orderNumber,
        marketplace_address_id: address.id,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: paymentMethod,
        paymentStatus: "pending",
        orderStatus: "pending",
        currency: baseCurrency,
        paid_amount: paidAmount,
        paid_currency: paidCurrency,
        fx_rate: fxRate,
        notes: null,
      },
      { transaction: t }
    );

    // Create order items from cart
    for (const ci of cartItems) {
      await MarketplaceOrderItems.create(
        {
          marketplace_order_id: order.id,
          marketplace_product_id: ci.marketplace_product_id,
          marketplace_product_variation_id:
            ci.marketplace_product_variation_id || null,
          name: ci.name || ci?.MarketplaceProduct?.title || "Product",
          quantity: ci.quantity,
          price: ci.price,
          subtotal:
            ci.subtotal || (Number(ci.price) * Number(ci.quantity)).toFixed(2),
          downloadUrl: null,
        },
        { transaction: t }
      );
    }

    await t.commit();

    return {
      success: true,
      message: "Checkout started",
      orderId: order.id,
      orderNumber,
      amount: paidAmount,
      currency: paidCurrency,
      baseAmount: Number(order.total),
      baseCurrency,
      fxRate,
      viewerCurrency,
      customer: { email, firstName, lastName },
    };
  } catch (e) {
    await t.rollback();

    return {
      success: false,
      message: e?.message || "Failed to start checkout",
    };
  }
}

export async function finalizeOrder(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, message: "Authentication required" };
  }

  const userId = session.user.id;
  const orderId = (formData.get("orderId") || "").toString();
  const status = (formData.get("status") || "").toString(); // 'success' | 'error'
  const reference = (formData.get("reference") || "").toString();
  const payloadRaw = (formData.get("payload") || "").toString();
  const email = (formData.get("email") || "").toString();

  if (!orderId) return { success: false, message: "Order ID missing" };

  const order = await MarketplaceOrder.findOne({
    where: { id: orderId, user_id: userId },
  });
  if (!order) return { success: false, message: "Order not found" };

  const t = await sequelize.transaction();
  try {
    const notes = payloadRaw
      ? order.notes
        ? `${order.notes}\n${payloadRaw}`
        : payloadRaw
      : order.notes;

    if (status === "success") {
      const payload = payloadRaw ? safeJsonParse(payloadRaw) : null;
      const meta = payload ? extractMetadata(payload) : null;
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
          notes,
          paid_amount: paid_amount != null ? paid_amount : order.paid_amount,
          paid_currency: paid_currency || order.paid_currency,
          fx_rate: fx_rate != null ? fx_rate : order.fx_rate,
        },
        { transaction: t }
      );

      // Decrement stock for each order item
      const items = await MarketplaceOrderItems.findAll({
        where: { marketplace_order_id: order.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      for (const it of items) {
        const product = await db.MarketplaceProduct.findByPk(it.marketplace_product_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (product && product.stock !== null && typeof product.stock !== 'undefined') {
          const current = Number(product.stock);
          const qty = Number(it.quantity);
          if (current < qty) {
            throw new Error(`Insufficient stock for ${product.title}`);
          }
          const newStock = current - qty;
          await product.update({ stock: newStock, inStock: newStock > 0 }, { transaction: t });
        }
      }

      // Clear cart
      const cart = await MarketplaceCart.findOne({
        where: { user_id: userId, active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (cart) {
        await MarketplaceCartItems.destroy({
          where: { marketplace_cart_id: cart.id },
          transaction: t,
        });
        await cart.update(
          { subtotal: 0, tax: 0, discount: 0, total: 0 },
          { transaction: t }
        );
      }

      await t.commit();

      // Send confirmation email (best-effort)
      try {
        if (email) {
          const items = await MarketplaceOrderItems.findAll({
            where: { marketplace_order_id: order.id },
          });
          const products = items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            price: Number(it.price),
            subtotal: Number(it.subtotal),
          }));
          const html = render(
            OrderConfirmationEmail({
              customerName: email,
              orderNumber: order.order_number,
              items: products,
              subtotal: Number(order.subtotal),
              tax: Number(order.tax || 0),
              discount: Number(order.discount || 0),
              total: Number(order.total),
            })
          );

          await sendEmail({
            to: email,
            subject: `Your CrowdPen order ${order.order_number} is confirmed`,
            html,
            text: `Order ${order.order_number} confirmed. Total: ${order.total}`,
          });
        }
      } catch (e) {
        console.error("order confirmation email error", e);
      }

      revalidatePath("/cart");
      revalidatePath("/account");

      return {
        success: true,
        message: "Order completed",
        orderNumber: order.order_number,
      };
    }

    // failure path
    await order.update(
      {
        paymentStatus: "failed",
        orderStatus: "pending",
        notes,
      },
      { transaction: t }
    );
    await t.commit();
    return {
      success: false,
      message: "Payment failed",
      orderNumber: order.order_number,
    };
  } catch (e) {
    await t.rollback();

    return {
      success: false,
      message: e?.message || "Failed to finalize order",
    };
  }
}
