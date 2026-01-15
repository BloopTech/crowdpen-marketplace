"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { headers } from "next/headers";
import { db } from "../../models";
import { revalidatePath } from "next/cache";
import { render, pretty } from "@react-email/render";
import { sendEmail } from "../../lib/sendEmail";
import { OrderConfirmationEmail } from "../../lib/emails/OrderConfirmation";
import {
  getRequestIdFromHeaders,
  reportError,
} from "../../lib/observability/reportError";

const {
  User,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceAddress,
  MarketplaceCoupon,
  MarketplaceCouponRedemption,
  MarketplaceCouponRedemptionItem,
  sequelize,
} = db;

function normalizeCurrency(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

function normalizePaymentProvider(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "startbutton" || v === "paystack") return v;
  return null;
}

function generatePaystackReference(orderNumber) {
  const base = (orderNumber || "").toString().trim();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  const parts = [base || "CP", "PS", ts, rand].filter(Boolean);
  return parts.join("-").slice(0, 90);
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
  return new Set([
    "NGN",
    "GHS",
    "ZAR",
    "KES",
    "UGX",
    "RWF",
    "TZS",
    "ZMW",
    "XOF",
    "USD",
  ]);
}

function getPaystackSupportedCurrencies() {
  const raw = process.env.PAYSTACK_SUPPORTED_CURRENCIES;
  if (raw) {
    const set = new Set(
      raw
        .split(",")
        .map((s) => normalizeCurrency(s))
        .filter(Boolean)
    );
    if (set.size > 0) return set;
  }

  return new Set(["NGN", "GHS", "ZAR", "USD"]);
}

function getStartButtonPublicKey() {
  return (
    process.env.NEXT_PUBLIC_STARTBUTTON_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_SB_PUBLIC_KEY ||
    process.env.STARTBUTTON_PUBLIC_KEY ||
    process.env.STARTBUTTON_PUBLISHABLE_KEY ||
    ""
  )
    .toString()
    .trim();
}

function getPaystackPublicKey() {
  return (process.env.PAYSTACK_PUBLICKEY || "").toString().trim();
}

function getPaystackSecretKey() {
  return (process.env.PAYSTACK_SECRETKEY || "").toString().trim();
}

async function getActivePaymentProvider() {
  if (!db?.MarketplacePaymentProviderSettings) return "startbutton";

  try {
    const row = await db.MarketplacePaymentProviderSettings.findOne({
      where: { is_active: true },
      order: [["createdAt", "DESC"]],
      attributes: ["active_provider"],
    });
    return normalizePaymentProvider(row?.active_provider) || "startbutton";
  } catch (e) {
    const code = e?.original?.code || e?.code;
    if (code === "42P01") return "startbutton";
    return "startbutton";
  }
}

async function verifyPaystackTransaction(reference) {
  const secret = getPaystackSecretKey();
  if (!secret) throw new Error("Paystack secret not configured");
  const ref = (reference || "").toString().trim();
  if (!ref) throw new Error("Missing Paystack reference");

  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`;
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("Payment verification unavailable. Please try again.");
  }

  let json = {};
  try {
    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      json = await upstream.json();
    } else {
      const text = await upstream.text();
      json = { message: text || undefined };
    }
  } catch {
    json = {};
  }
  if (!upstream.ok || json?.status !== true) {
    const msg = json?.message || "Verification failed";
    throw new Error(msg);
  }
  return json?.data || null;
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

function buildItemsSignature(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr
    .map((it) => {
      const pid = (it?.marketplace_product_id || "").toString();
      const vid = (it?.marketplace_product_variation_id || "").toString();
      const qty = Number(it?.quantity || 0);
      return `${pid}:${vid}:${qty}`;
    })
    .sort()
    .join("|");
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

// Helper to compute effective price respecting discount expiry
function computeEffectivePrice(product) {
  const priceNum = Number(product.price);
  const originalPriceNum = Number(product.originalPrice);
  const hasDiscount =
    Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const saleEndMs = product.sale_end_date
    ? new Date(product.sale_end_date).getTime()
    : null;
  const isExpired =
    hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
  return isExpired ? originalPriceNum : priceNum;
}

function couponValidity(coupon) {
  const now = Date.now();
  const startMs = coupon?.start_date
    ? new Date(coupon.start_date).getTime()
    : null;
  const endMs = coupon?.end_date ? new Date(coupon.end_date).getTime() : null;
  if (coupon?.is_active === false) return { ok: false, reason: "inactive" };
  if (Number.isFinite(startMs) && startMs > now)
    return { ok: false, reason: "not_started" };
  if (Number.isFinite(endMs) && endMs < now)
    return { ok: false, reason: "expired" };
  return { ok: true, reason: null };
}

function computeCouponDiscount(coupon, eligibleSubtotal) {
  const eligible = Number(eligibleSubtotal || 0);
  if (!Number.isFinite(eligible) || eligible <= 0) return 0;

  const t = String(coupon?.discount_type || "").toLowerCase();
  const val = Number(coupon?.discount_value || 0);
  if (!Number.isFinite(val) || val <= 0) return 0;

  let discount = 0;
  if (t === "percentage") discount = eligible * (val / 100);
  else if (t === "fixed") discount = val;

  if (discount > eligible) discount = eligible;

  const maxRaw = coupon?.max_discount_amount;
  const max = maxRaw != null ? Number(maxRaw) : null;
  if (max != null && Number.isFinite(max) && max >= 0 && discount > max)
    discount = max;

  return Number(discount.toFixed(2));
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

  const paymentProvider = await getActivePaymentProvider();
  const publicKey =
    paymentProvider === "paystack"
      ? getPaystackPublicKey()
      : getStartButtonPublicKey();
  if (!publicKey) {
    return {
      success: false,
      message: "Payment gateway is not configured",
      errors: { payment: ["Payment gateway is not configured"] },
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
  const paymentMethod = paymentProvider;
  const existingOrderId = (formData.get("existingOrderId") || "")
    .toString()
    .trim();

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
          "price",
          "originalPrice",
          "sale_end_date",
          "product_status",
          "user_id",
          "stock",
          "inStock",
          "currency",
          "file",
          "fileType",
          "marketplace_category_id",
        ],
        include: [
          {
            model: db.User,
            attributes: ["id", "role", "crowdpen_staff", "merchant"],
            include: [
              {
                model: db.MarketplaceKycVerification,
                attributes: ["status"],
                required: false,
              },
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

  // Product status gating: disallow checkout if any product is not published (unless viewer is owner)
  const statusBlocked = cartItems.filter((ci) => {
    const p = ci?.MarketplaceProduct;
    if (!p) return true;
    const isOwner = p.user_id === userId;
    return !isOwner && p.product_status !== "published";
  });
  if (statusBlocked.length > 0) {
    const titles = statusBlocked
      .map((ci) => ci?.MarketplaceProduct?.title || ci?.name || "Item")
      .filter(Boolean);
    const idsToRemove = statusBlocked.map((ci) => ci?.id).filter(Boolean);
    try {
      if (idsToRemove.length) {
        await MarketplaceCartItems.destroy({
          where: {
            id: idsToRemove,
            marketplace_cart_id: cart.id,
          },
        });
      }
      const remaining = cartItems.filter((ci) => !idsToRemove.includes(ci?.id));
      if (remaining.length === 0) {
        await cart.destroy();
        return {
          success: false,
          message: "Your cart is empty.",
          errors: { cart: ["No available items"] },
        };
      }

      let subtotal = 0;
      for (const ci of remaining) {
        const p = ci?.MarketplaceProduct;
        if (!p) continue;
        const effectivePrice = computeEffectivePrice(p);
        const itemTotal = effectivePrice * (ci.quantity || 1);
        subtotal += itemTotal;
      }

      const discount = Number(cart.discount ?? 0);
      const total = subtotal - discount;
      await cart.update({
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
      });
    } catch (cleanupError) {
      let requestId = null;
      try {
        requestId = getRequestIdFromHeaders(await headers());
      } catch {
        requestId = null;
      }
      await reportError(cleanupError, {
        tag: "checkout_status_cleanup_error",
        route: "server_action:checkout#beginCheckout",
        method: "SERVER_ACTION",
        status: 500,
        requestId,
        userId,
      });
    }
    return {
      success: false,
      message: `Some items are no longer available and were removed from your cart: ${titles.join(", ")}`,
      errors: { cart: ["Contains unavailable products"] },
    };
  }

  // KYC gating: disallow checkout if any item is from an owner whose KYC is not approved (unless item owner is the viewer)
  const kycBlocked = cartItems.filter((ci) => {
    const p = ci?.MarketplaceProduct;
    if (!p) return false;
    const isOwner = p.user_id === userId;
    const ownerApproved =
      p?.User?.MarketplaceKycVerification?.status === "approved" ||
      User.isKycExempt(p?.User) ||
      p?.User?.merchant === true;
    return !isOwner && !ownerApproved;
  });
  if (kycBlocked.length > 0) {
    const titles = kycBlocked
      .map((ci) => ci?.MarketplaceProduct?.title)
      .filter(Boolean);
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
    const out =
      p?.inStock === false ||
      (p?.stock !== null &&
        typeof p?.stock !== "undefined" &&
        Number(p.stock) <= 0);
    const exceeds =
      p?.stock !== null &&
      typeof p?.stock !== "undefined" &&
      Number(ci.quantity) > Number(p.stock);
    return out || exceeds;
  });
  if (stockIssues.length > 0) {
    const titles = stockIssues
      .map((ci) => ci?.MarketplaceProduct?.title)
      .filter(Boolean);
    return {
      success: false,
      message: `Some items are out of stock or exceed available quantity: ${titles.join(", ")}`,
      errors: { cart: ["Insufficient stock"] },
    };
  }

  // Compute totals from cart using effective price (respecting discount expiry)
  let subtotal = 0;
  for (const ci of cartItems) {
    const p = ci?.MarketplaceProduct;
    if (!p) continue;
    const effectivePrice = computeEffectivePrice(p);
    const itemTotal = effectivePrice * (ci.quantity || 1);
    subtotal += itemTotal;
    // Update stored price if it differs from effective price calculation
    const storedPrice = Number(ci.price || 0);
    if (Math.abs(storedPrice - itemTotal) > 0.01) {
      await ci.update({
        price: itemTotal.toFixed(2),
        subtotal: itemTotal.toFixed(2),
      });
    }
  }

  let discount = 0;
  let coupon = null;
  let couponNotice = null;

  if (cart.coupon_id) {
    coupon = await MarketplaceCoupon.findByPk(cart.coupon_id);
    if (!coupon) {
      await cart.update({
        coupon_id: null,
        coupon_code: null,
        coupon_applied_at: null,
        discount: 0,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
      });
      couponNotice = { code: cart.coupon_code || null, reason: "not_found" };
      coupon = null;
    }

    if (coupon) {
      const valid = couponValidity(coupon);
      if (!valid.ok) {
        await cart.update({
          coupon_id: null,
          coupon_code: null,
          coupon_applied_at: null,
          discount: 0,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
        });
        couponNotice = {
          code: cart.coupon_code || coupon.code || null,
          reason: valid.reason,
        };
        coupon = null;
      }
    }

    if (coupon && coupon.usage_limit != null) {
      const limit = Number(coupon.usage_limit);
      const used = Number(coupon.usage_count || 0);
      if (Number.isFinite(limit) && limit > 0 && used >= limit) {
        await cart.update({
          coupon_id: null,
          coupon_code: null,
          coupon_applied_at: null,
          discount: 0,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
        });
        couponNotice = {
          code: cart.coupon_code || coupon.code || null,
          reason: "usage_limit",
        };
        coupon = null;
      }
    }

    if (coupon) {
      const appliesTo = String(coupon.applies_to || "all").toLowerCase();
      const ids = Array.isArray(coupon.applies_to_ids)
        ? coupon.applies_to_ids
        : [];
      const set = new Set(ids.map((v) => String(v)));
      const eligibleSubtotal = cartItems.reduce((acc, ci) => {
        const p = ci?.MarketplaceProduct;
        if (!p) return acc;
        const match =
          appliesTo === "all" ||
          (appliesTo === "product" && set.has(String(p.id))) ||
          (appliesTo === "category" &&
            set.has(String(p.marketplace_category_id || "")));
        if (!match) return acc;
        const effectivePrice = computeEffectivePrice(p);
        return acc + effectivePrice * (ci.quantity || 1);
      }, 0);

      const minAmount =
        coupon?.min_order_amount != null ? Number(coupon.min_order_amount) : 0;
      if (
        Number.isFinite(minAmount) &&
        minAmount > 0 &&
        eligibleSubtotal < minAmount
      ) {
        await cart.update({
          coupon_id: null,
          coupon_code: null,
          coupon_applied_at: null,
          discount: 0,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
        });
        couponNotice = {
          code: cart.coupon_code || coupon.code || null,
          reason: "min_order_amount",
        };
        coupon = null;
      } else {
        discount = computeCouponDiscount(coupon, eligibleSubtotal);
        if (
          (cart.coupon_code || "").toString().trim().toUpperCase() !==
          String(coupon.code).toUpperCase()
        ) {
          await cart.update({ coupon_code: coupon.code });
        }
      }
    }
  }

  const total = subtotal - discount;

  // Update cart totals if they differ
  if (Math.abs(Number(cart.subtotal) - subtotal) > 0.01) {
    await cart.update({
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      total: total.toFixed(2),
    });
  }

  const baseCurrency = "USD";
  const ipCountry = await getHeaderCountry();
  const supported =
    paymentProvider === "paystack"
      ? getPaystackSupportedCurrencies()
      : getStartButtonSupportedCurrencies();
  const viewerCurrency =
    normalizeCurrency(deriveCurrencyByCountry(ipCountry)) || baseCurrency;

  // Choose a charge currency that StartButton supports and for which we have an FX rate.
  const candidates = Array.from(
    new Set(
      [viewerCurrency, baseCurrency, "GHS"]
        .map((c) => normalizeCurrency(c))
        .filter(Boolean)
    )
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

  const cartSig = buildItemsSignature(cartItems);
  let reuseOrderId = existingOrderId;
  if (!reuseOrderId && cartSig) {
    const Op = db?.Sequelize?.Op;
    if (Op) {
      const since = new Date(Date.now() - 15 * 60 * 1000);
      const candidates = await MarketplaceOrder.findAll({
        where: {
          user_id: userId,
          paymentStatus: "pending",
          orderStatus: { [Op.in]: ["pending", "processing"] },
          createdAt: { [Op.gte]: since },
        },
        order: [["createdAt", "DESC"]],
        limit: 3,
      });

      for (const cand of candidates) {
        const orderItems = await MarketplaceOrderItems.findAll({
          where: { marketplace_order_id: cand.id },
        });
        const orderSig = buildItemsSignature(orderItems);
        if (orderSig && orderSig === cartSig) {
          reuseOrderId = cand.id;
          break;
        }
      }
    }
  }

  // If a previous attempt created an order, reuse it (retry-safe)
  if (reuseOrderId) {
    try {
      const existing = await MarketplaceOrder.findOne({
        where: { id: reuseOrderId, user_id: userId },
      });
      if (existing) {
        const payStatus = String(existing.paymentStatus || "").toLowerCase();
        const ordStatus = String(existing.orderStatus || "").toLowerCase();
        const alreadySuccessful =
          payStatus === "successful" || ordStatus === "successful";

        if (alreadySuccessful) {
          const providerReference =
            paymentProvider === "paystack"
              ? existing.paystackReferenceId ||
                generatePaystackReference(existing.order_number)
              : null;
          return {
            success: true,
            message: "Checkout started",
            coupon_notice: couponNotice,
            publicKey,
            paymentProvider,
            providerReference,
            orderId: existing.id,
            orderNumber: existing.order_number,
            amount: Number(existing.paid_amount || paidAmount),
            currency: (
              existing.paid_currency ||
              paidCurrency ||
              baseCurrency
            ).toString(),
            baseAmount: Number(existing.total || total),
            baseCurrency,
            fxRate: Number(existing.fx_rate || fxRate),
            viewerCurrency,
            customer: { email, firstName, lastName },
          };
        }

        const orderItems = await MarketplaceOrderItems.findAll({
          where: { marketplace_order_id: existing.id },
        });
        const orderSig = buildItemsSignature(orderItems);
        if (!cartSig || cartSig !== orderSig) {
          throw new Error("Existing order no longer matches cart");
        }

        // If it's still pending, refresh totals and continue using the same order.
        const providerReference =
          paymentProvider === "paystack"
            ? existing.paystackReferenceId ||
              generatePaystackReference(existing.order_number)
            : null;
        await existing.update({
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: paymentMethod,
          payment_provider: paymentProvider,
          ...(paymentProvider === "paystack" && providerReference
            ? { paystackReferenceId: providerReference }
            : {}),
          currency: baseCurrency,
          couponCode: cart.coupon_code || null,
          paid_amount: paidAmount,
          paid_currency: paidCurrency,
          fx_rate: fxRate,
        });

        const itemMap = new Map(
          orderItems.map((oi) => [
            `${oi?.marketplace_product_id || ""}:${oi?.marketplace_product_variation_id || ""}`,
            oi,
          ])
        );

        for (const ci of cartItems) {
          const key = `${ci?.marketplace_product_id || ""}:${ci?.marketplace_product_variation_id || ""}`;
          const oi = itemMap.get(key);
          if (!oi) continue;

          const p = ci?.MarketplaceProduct;
          const file = p?.file != null ? String(p.file).trim() : "";
          const lineSubtotal =
            ci?.subtotal != null
              ? Number(ci.subtotal).toFixed(2)
              : (Number(ci.price) * Number(ci.quantity || 1)).toFixed(2);

          await oi.update({
            name: ci.name || p?.title || oi.name,
            quantity: ci.quantity || 1,
            price: ci.price,
            subtotal: lineSubtotal,
            downloadUrl: file || null,
          });
        }

        const redemption = await MarketplaceCouponRedemption.findOne({
          where: { order_id: existing.id },
        });

        if (coupon && discount > 0) {
          if (redemption) {
            await redemption.update({
              coupon_id: coupon.id,
              cart_id: cart.id,
              status:
                redemption.status === "failed" ? "pending" : redemption.status,
              discount_total: discount.toFixed(2),
              currency: baseCurrency,
            });
          }
        } else if (redemption && redemption.status === "pending") {
          await redemption.update({ status: "failed" });
        }

        return {
          success: true,
          message: "Checkout started",
          coupon_notice: couponNotice,
          publicKey,
          paymentProvider,
          providerReference,
          orderId: existing.id,
          orderNumber: existing.order_number,
          amount: paidAmount,
          currency: paidCurrency,
          baseAmount: Number(total),
          baseCurrency,
          fxRate,
          viewerCurrency,
          customer: { email, firstName, lastName },
        };
      }
    } catch (e) {
      // ignore and fall back to creating a new order
      let requestId = null;
      try {
        requestId = getRequestIdFromHeaders(await headers());
      } catch {
        requestId = null;
      }
      await reportError(e, {
        tag: "begin_checkout_existing_order_reuse_error",
        route: "server_action:checkout#beginCheckout",
        method: "SERVER_ACTION",
        status: 500,
        requestId,
        userId,
      });
    }
  }

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
    const providerReference =
      paymentProvider === "paystack"
        ? generatePaystackReference(orderNumber)
        : null;
    const order = await MarketplaceOrder.create(
      {
        user_id: userId,
        order_number: orderNumber,
        marketplace_address_id: address.id,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: paymentMethod,
        payment_provider: paymentProvider,
        paymentStatus: "pending",
        orderStatus: "pending",
        currency: baseCurrency,
        couponCode: cart.coupon_code || null,
        paid_amount: paidAmount,
        paid_currency: paidCurrency,
        fx_rate: fxRate,
        ...(paymentProvider === "paystack" && providerReference
          ? { paystackReferenceId: providerReference }
          : {}),
        notes: null,
      },
      { transaction: t }
    );

    // Create order items from cart
    const createdItems = [];
    for (const ci of cartItems) {
      const file =
        ci?.MarketplaceProduct?.file != null
          ? String(ci.MarketplaceProduct.file).trim()
          : "";
      const created = await MarketplaceOrderItems.create(
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
          downloadUrl: file || null,
        },
        { transaction: t }
      );
      createdItems.push(created);
    }

    if (coupon && discount > 0) {
      const redemption = await MarketplaceCouponRedemption.create(
        {
          coupon_id: coupon.id,
          user_id: userId,
          order_id: order.id,
          cart_id: cart.id,
          status: "pending",
          discount_total: discount.toFixed(2),
          currency: baseCurrency,
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
        { transaction: t }
      );

      const productIds = Array.from(
        new Set(createdItems.map((it) => String(it.marketplace_product_id)))
      );
      const productRows = await db.MarketplaceProduct.findAll({
        where: { id: productIds },
        attributes: ["id", "marketplace_category_id"],
        transaction: t,
      });
      const productCategoryMap = new Map(
        productRows.map((r) => [
          String(r.id),
          String(r.marketplace_category_id || ""),
        ])
      );

      const appliesTo = String(coupon.applies_to || "all").toLowerCase();
      const ids = Array.isArray(coupon.applies_to_ids)
        ? coupon.applies_to_ids
        : [];
      const set = new Set(ids.map((v) => String(v)));

      const eligibleItems = createdItems.filter((it) => {
        if (appliesTo === "all") return true;
        if (appliesTo === "product")
          return set.has(String(it.marketplace_product_id));
        if (appliesTo === "category") {
          const cat =
            productCategoryMap.get(String(it.marketplace_product_id)) || "";
          return set.has(String(cat));
        }
        return false;
      });

      const eligibleSubtotal = eligibleItems.reduce(
        (acc, it) => acc + (Number(it.subtotal || 0) || 0),
        0
      );

      if (eligibleItems.length > 0 && eligibleSubtotal > 0) {
        const rows = [];
        let allocated = 0;
        for (let i = 0; i < eligibleItems.length; i++) {
          const it = eligibleItems[i];
          const itemSubtotal = Number(it.subtotal || 0) || 0;
          let amt;
          if (i === eligibleItems.length - 1) {
            amt = Number((discount - allocated).toFixed(2));
          } else {
            const share = itemSubtotal / eligibleSubtotal;
            amt = Number((discount * share).toFixed(2));
            allocated = Number((allocated + amt).toFixed(2));
          }
          if (amt < 0) amt = 0;
          rows.push({
            redemption_id: redemption.id,
            order_item_id: it.id,
            product_id: it.marketplace_product_id,
            discount_amount: amt.toFixed(2),
          });
        }

        await MarketplaceCouponRedemptionItem.bulkCreate(rows, {
          transaction: t,
        });
      }
    }

    await t.commit();

    return {
      success: true,
      message: "Checkout started",
      coupon_notice: couponNotice,
      publicKey,
      paymentProvider,
      providerReference,
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

  const alreadySuccessful =
    String(order.paymentStatus || "").toLowerCase() === "successful" ||
    String(order.orderStatus || "").toLowerCase() === "successful";
  if (alreadySuccessful) {
    return {
      success: true,
      message: "Order completed",
      orderNumber: order.order_number,
    };
  }

  const t = await sequelize.transaction();
  try {
    const notes = payloadRaw
      ? order.notes
        ? `${order.notes}\n${payloadRaw}`
        : payloadRaw
      : order.notes;

    const provider =
      normalizePaymentProvider(order.payment_provider) ||
      normalizePaymentProvider(order.paymentMethod) ||
      "startbutton";
    const referenceUpdate =
      provider === "paystack"
        ? { paystackReferenceId: reference || order.paystackReferenceId }
        : { startbuttonReferenceId: reference || order.startbuttonReferenceId };

    if (status === "success") {
      const payload = payloadRaw ? safeJsonParse(payloadRaw) : null;
      const meta = payload ? extractMetadata(payload) : null;

      let paid_amount =
        toFiniteNumber(meta?.paidAmount) ?? toFiniteNumber(meta?.paid_amount);
      let fx_rate =
        toFiniteNumber(meta?.fxRate) ?? toFiniteNumber(meta?.fx_rate);
      let paid_currency = (meta?.paidCurrency || meta?.paid_currency || "")
        .toString()
        .trim()
        .toUpperCase();

      let isSettled = false;

      if (provider === "paystack") {
        const verified = await verifyPaystackTransaction(
          reference || order.paystackReferenceId
        );
        const vStatus = (verified?.status || "").toString().toLowerCase();
        if (vStatus !== "success") {
          await order.update(
            {
              paymentStatus: "failed",
              orderStatus: "failed",
              payment_provider: order.payment_provider || provider,
              ...referenceUpdate,
              notes,
            },
            { transaction: t }
          );
          await t.commit();
          return {
            success: false,
            message: "We couldn't confirm your Paystack payment.",
            orderNumber: order.order_number,
          };
        }

        const vAmount = Number(verified?.amount);
        const vCurrency = (verified?.currency || "")
          .toString()
          .trim()
          .toUpperCase();
        const vMeta = verified?.metadata || null;

        if (Number.isFinite(vAmount) && vAmount > 0) {
          paid_amount = Number((vAmount / 100).toFixed(2));
        }
        if (vCurrency) {
          paid_currency = vCurrency;
        }
        if (vMeta) {
          fx_rate =
            toFiniteNumber(vMeta?.fxRate) ??
            toFiniteNumber(vMeta?.fx_rate) ??
            fx_rate;
        }

        const expectedMinor = Math.round(Number(order.paid_amount || 0) * 100);
        if (
          Number.isFinite(expectedMinor) &&
          expectedMinor > 0 &&
          Number.isFinite(vAmount) &&
          vAmount > 0 &&
          Math.abs(vAmount - expectedMinor) > 5
        ) {
          throw new Error("Payment amount mismatch");
        }
        if (order.paid_currency && vCurrency) {
          const oCur = String(order.paid_currency).toUpperCase();
          if (oCur && vCurrency && oCur !== vCurrency) {
            throw new Error("Payment currency mismatch");
          }
        }

        if (vMeta?.orderId && String(vMeta.orderId) !== String(order.id)) {
          throw new Error("Payment verification mismatch");
        }

        isSettled = true;
      } else {
        const stageParts = [
          payload?.event,
          payload?.status,
          payload?.data?.status,
          payload?.data?.transaction?.status,
          payload?.data?.transaction?.transactionStatus,
        ]
          .filter(Boolean)
          .map((v) => String(v))
          .join(" |")
          .toLowerCase();
        isSettled =
          stageParts.includes("collection.completed") ||
          stageParts.includes("completed");
      }

      const nextOrderStatus = isSettled ? "successful" : "processing";

      if (!isSettled) {
        await order.update(
          {
            orderStatus: nextOrderStatus,
            payment_provider: order.payment_provider || provider,
            ...referenceUpdate,
            notes,
            paid_amount: paid_amount != null ? paid_amount : order.paid_amount,
            paid_currency: paid_currency || order.paid_currency,
            fx_rate: fx_rate != null ? fx_rate : order.fx_rate,
          },
          { transaction: t }
        );

        await t.commit();
        revalidatePath("/cart");
        revalidatePath("/account");

        return {
          success: true,
          message: "Payment is processing",
          orderNumber: order.order_number,
          settled: false,
        };
      }

      await order.update(
        {
          paymentStatus: "successful",
          orderStatus: nextOrderStatus,
          payment_provider: order.payment_provider || provider,
          ...referenceUpdate,
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
        const product = await db.MarketplaceProduct.findByPk(
          it.marketplace_product_id,
          { transaction: t, lock: t.LOCK.UPDATE }
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
        where: { order_id: order.id },
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
          const html = await pretty(
            await render(
              <OrderConfirmationEmail
                customerName={email}
                orderNumber={order.order_number}
                items={products}
                subtotal={Number(order.subtotal)}
                discount={Number(order.discount || 0)}
                total={Number(order.total)}
                currencyCode={
                  String(order.paid_currency || order.currency || "USD")
                    .trim()
                    .toUpperCase()
                }
              />
            )
          );

          await sendEmail({
            to: email,
            subject: `Your CrowdPen order ${order.order_number} is confirmed`,
            html,
            text: `Order ${order.order_number} confirmed. Total: ${order.total}`,
          });
        }
      } catch (e) {
        let requestId = null;
        try {
          requestId = getRequestIdFromHeaders(await headers());
        } catch {
          requestId = null;
        }
        await reportError(e, {
          tag: "order_confirmation_email_error",
          route: "server_action:checkout#finalizeOrder",
          method: "SERVER_ACTION",
          status: 500,
          requestId,
          userId,
        });
      }

      revalidatePath("/cart");
      revalidatePath("/account");
      revalidatePath("/admin");

      return {
        success: true,
        message: "Order completed",
        orderNumber: order.order_number,
        settled: true,
      };
    }

    // failure path
    await order.update(
      {
        paymentStatus: "failed",
        orderStatus: "failed",
        notes,
      },
      { transaction: t }
    );

    const redemption = await MarketplaceCouponRedemption.findOne({
      where: { order_id: order.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (redemption && redemption.status === "pending") {
      await redemption.update({ status: "failed" }, { transaction: t });
    }

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
