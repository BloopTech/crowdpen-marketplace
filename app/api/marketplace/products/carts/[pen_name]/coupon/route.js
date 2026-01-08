import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { db } from "../../../../../../models/index";
import { z } from "zod";
import {
  getClientIpFromHeaders,
  rateLimit,
  rateLimitResponseHeaders,
} from "../../../../../../lib/security/rateLimit";

const {
  User,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceProduct,
  MarketplaceCoupon,
  MarketplaceCouponApplication,
} = db;

const applyCouponSchema = z.object({
  code: z.string().min(1).max(50),
});

function normalizeCouponCode(v) {
  return String(v || "").trim().toUpperCase();
}

function isCouponExpired(coupon) {
  const now = Date.now();
  const startMs = coupon?.start_date ? new Date(coupon.start_date).getTime() : null;
  const endMs = coupon?.end_date ? new Date(coupon.end_date).getTime() : null;
  if (Number.isFinite(startMs) && startMs > now) return { ok: false, reason: "not_started" };
  if (Number.isFinite(endMs) && endMs < now) return { ok: false, reason: "expired" };
  if (coupon?.is_active === false) return { ok: false, reason: "inactive" };
  return { ok: true, reason: null };
}

function computeEffectivePrice(product) {
  const priceNum = Number(product.price);
  const originalPriceNum = Number(product.originalPrice);
  const hasDiscount = Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const saleEndMs = product.sale_end_date ? new Date(product.sale_end_date).getTime() : null;
  const isExpired = hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
  return isExpired ? originalPriceNum : priceNum;
}

function computeDiscount({ coupon, eligibleSubtotal }) {
  const eligible = Number(eligibleSubtotal || 0);
  if (!Number.isFinite(eligible) || eligible <= 0) return 0;

  const t = String(coupon?.discount_type || "").toLowerCase();
  const val = Number(coupon?.discount_value || 0);
  if (!Number.isFinite(val) || val <= 0) return 0;

  let discount = 0;
  if (t === "percentage") {
    discount = eligible * (val / 100);
  } else if (t === "fixed") {
    discount = val;
  }

  if (discount > eligible) discount = eligible;

  const maxRaw = coupon?.max_discount_amount;
  const max = maxRaw != null ? Number(maxRaw) : null;
  if (max != null && Number.isFinite(max) && max >= 0) {
    if (discount > max) discount = max;
  }

  return Number(discount.toFixed(2));
}

function computeEligibility({ coupon, cartItems }) {
  const appliesTo = String(coupon?.applies_to || "all").toLowerCase();
  const ids = Array.isArray(coupon?.applies_to_ids) ? coupon.applies_to_ids : [];
  const set = new Set(ids.map((v) => String(v)));

  return cartItems.map((ci) => {
    const p = ci?.MarketplaceProduct;
    const pid = String(p?.id || "");
    const catId = String(p?.marketplace_category_id || "");

    if (appliesTo === "all") return { cartItem: ci, eligible: true };
    if (appliesTo === "product") return { cartItem: ci, eligible: set.has(pid) };
    if (appliesTo === "category") return { cartItem: ci, eligible: set.has(catId) };
    return { cartItem: ci, eligible: false };
  });
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `cart-coupon-apply:${userIdForRl}:${ip}`, limit: 30, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const getParams = await params;
    const penNameRaw = String(getParams?.pen_name || "").trim();
    if (!penNameRaw || penNameRaw.length > 80) {
      return NextResponse.json({ error: "Pen name is required" }, { status: 400 });
    }

    const sessionUser = await User.findByPk(session.user.id, {
      attributes: ["id", "pen_name"],
    });
    if (!sessionUser || String(sessionUser.pen_name || "") !== String(penNameRaw)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = applyCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const code = normalizeCouponCode(parsed.data.code);
    if (code.length < 3 || code.length > 50 || !/^[A-Z0-9_-]+$/.test(code)) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
    }

    const cart = await MarketplaceCart.findOne({
      where: { user_id: session.user.id, active: true },
    });

    if (!cart) {
      return NextResponse.json({ error: "No active cart" }, { status: 400 });
    }

    const coupon = await MarketplaceCoupon.findOne({ where: { code } });
    if (!coupon) {
      await MarketplaceCouponApplication.create({
        coupon_id: null,
        user_id: session.user.id,
        cart_id: cart.id,
        code,
        eligible_subtotal: 0,
        discount_preview: 0,
        currency: (cart?.currency || "USD").toString().toUpperCase(),
        status: "rejected",
        reason: "not_found",
      });
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
    }

    const validity = isCouponExpired(coupon);
    if (!validity.ok) {
      await MarketplaceCouponApplication.create({
        coupon_id: coupon.id,
        user_id: session.user.id,
        cart_id: cart.id,
        code,
        eligible_subtotal: 0,
        discount_preview: 0,
        currency: (cart?.currency || "USD").toString().toUpperCase(),
        status: "rejected",
        reason: validity.reason,
      });

      return NextResponse.json(
        {
          error:
            validity.reason === "expired"
              ? "This coupon has expired"
              : validity.reason === "not_started"
                ? "This coupon is not active yet"
                : "This coupon is not active",
        },
        { status: 400 }
      );
    }

    if (coupon.usage_limit != null) {
      const limit = Number(coupon.usage_limit);
      const used = Number(coupon.usage_count || 0);
      if (Number.isFinite(limit) && limit > 0 && used >= limit) {
        await MarketplaceCouponApplication.create({
          coupon_id: coupon.id,
          user_id: session.user.id,
          cart_id: cart.id,
          code,
          eligible_subtotal: 0,
          discount_preview: 0,
          currency: (cart?.currency || "USD").toString().toUpperCase(),
          status: "rejected",
          reason: "usage_limit",
        });
        return NextResponse.json({ error: "This coupon has reached its usage limit" }, { status: 400 });
      }
    }

    const cartItems = await MarketplaceCartItems.findAll({
      where: { marketplace_cart_id: cart.id },
      include: [
        {
          model: MarketplaceProduct,
          attributes: [
            "id",
            "price",
            "originalPrice",
            "sale_end_date",
            "marketplace_category_id",
          ],
        },
      ],
    });

    if (!cartItems.length) {
      return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
    }

    let subtotal = 0;
    for (const ci of cartItems) {
      const p = ci?.MarketplaceProduct;
      if (!p) continue;
      const effectivePrice = computeEffectivePrice(p);
      const itemTotal = effectivePrice * (ci.quantity || 1);
      subtotal += itemTotal;
      const storedPrice = Number(ci.price || 0);
      if (Math.abs(storedPrice - itemTotal) > 0.01) {
        await ci.update({ price: itemTotal.toFixed(2), subtotal: itemTotal.toFixed(2) });
      }
    }

    const eligibility = computeEligibility({ coupon, cartItems });
    const eligibleSubtotal = eligibility.reduce((acc, row) => {
      if (!row.eligible) return acc;
      const p = row?.cartItem?.MarketplaceProduct;
      if (!p) return acc;
      const effectivePrice = computeEffectivePrice(p);
      const itemTotal = effectivePrice * (row.cartItem.quantity || 1);
      return acc + itemTotal;
    }, 0);

    const minAmount = coupon?.min_order_amount != null ? Number(coupon.min_order_amount) : 0;
    if (Number.isFinite(minAmount) && minAmount > 0 && eligibleSubtotal < minAmount) {
      await MarketplaceCouponApplication.create({
        coupon_id: coupon.id,
        user_id: session.user.id,
        cart_id: cart.id,
        code,
        eligible_subtotal: eligibleSubtotal.toFixed(2),
        discount_preview: 0,
        currency: (cart?.currency || "USD").toString().toUpperCase(),
        status: "rejected",
        reason: "min_order_amount",
      });
      return NextResponse.json({ error: "Cart does not meet minimum amount for this coupon" }, { status: 400 });
    }

    const discount = computeDiscount({ coupon, eligibleSubtotal });

    await cart.update({
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      total: (subtotal - discount).toFixed(2),
      currency: "USD",
      coupon_id: coupon.id,
      coupon_code: coupon.code,
      coupon_applied_at: new Date(),
    });

    await MarketplaceCouponApplication.create({
      coupon_id: coupon.id,
      user_id: session.user.id,
      cart_id: cart.id,
      code,
      eligible_subtotal: eligibleSubtotal.toFixed(2),
      discount_preview: discount.toFixed(2),
      currency: "USD",
      status: "applied",
      reason: null,
    });

    return NextResponse.json({
      success: true,
      data: {
        cart: {
          id: cart.id,
          subtotal: Number(subtotal.toFixed(2)),
          discount: Number(discount.toFixed(2)),
          total: Number((subtotal - discount).toFixed(2)),
          currency: "USD",
          coupon_id: coupon.id,
          coupon_code: coupon.code,
          coupon_applied_at: cart.coupon_applied_at,
        },
      },
    });
  } catch (error) {
    console.error("Apply coupon error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: "Internal server error", ...(isProd ? {} : { details: error?.message }) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `cart-coupon-remove:${userIdForRl}:${ip}`, limit: 30, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const getParams = await params;
    const penNameRaw = String(getParams?.pen_name || "").trim();
    if (!penNameRaw || penNameRaw.length > 80) {
      return NextResponse.json({ error: "Pen name is required" }, { status: 400 });
    }

    const sessionUser = await User.findByPk(session.user.id, {
      attributes: ["id", "pen_name"],
    });
    if (!sessionUser || String(sessionUser.pen_name || "") !== String(penNameRaw)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const cart = await MarketplaceCart.findOne({
      where: { user_id: session.user.id, active: true },
    });

    if (!cart) {
      return NextResponse.json({ success: true, data: { removed: false } });
    }

    const prevCode = (cart.coupon_code || "").toString().trim();
    const prevCouponId = cart.coupon_id || null;

    await cart.update({
      discount: 0,
      total: Number(cart.subtotal || 0).toFixed(2),
      coupon_id: null,
      coupon_code: null,
      coupon_applied_at: null,
    });

    if (prevCode) {
      await MarketplaceCouponApplication.create({
        coupon_id: prevCouponId,
        user_id: session.user.id,
        cart_id: cart.id,
        code: prevCode.toUpperCase(),
        eligible_subtotal: 0,
        discount_preview: 0,
        currency: (cart?.currency || "USD").toString().toUpperCase(),
        status: "removed",
        reason: null,
      });
    }

    return NextResponse.json({ success: true, data: { removed: !!prevCode } });
  } catch (error) {
    console.error("Remove coupon error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: "Internal server error", ...(isProd ? {} : { details: error?.message }) },
      { status: 500 }
    );
  }
}
