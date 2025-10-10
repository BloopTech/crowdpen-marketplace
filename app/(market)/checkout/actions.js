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

function getHeaderCountry() {
  try {
    const h = headers();
    const vercel = h.get("x-vercel-ip-country");
    const cf = h.get("cf-ipcountry");
    const generic = h.get("x-country-code");
    const code = (vercel || cf || generic || "").toUpperCase();
    return code || null;
  } catch {
    return null;
  }
}

function deriveCurrencyByCountry(countryCode) {
  const c = (countryCode || "").toUpperCase();
  const map = {
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
  };
  return map[c] || null;
}

export async function beginCheckout(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, message: "Authentication required", errors: { auth: ["Please log in"] } };
  }

  const userId = session.user.id;
  const email = (formData.get("email") || "").toString().trim();
  const firstName = (formData.get("firstName") || "").toString().trim();
  const lastName = (formData.get("lastName") || "").toString().trim();
  const billingAddress = (formData.get("billingAddress") || "").toString().trim();
  const city = (formData.get("city") || "").toString().trim();
  const zipCode = (formData.get("zipCode") || "").toString().trim();
  const country = (formData.get("country") || "").toString().trim() || "NG";
  const paymentMethod = (formData.get("paymentMethod") || "startbutton").toString();

  if (!email || !firstName || !lastName || !billingAddress || !city || !zipCode) {
    return { success: false, message: "Please complete all required fields.", errors: { form: ["Missing required fields"] } };
  }

  // Find active cart
  const cart = await MarketplaceCart.findOne({ where: { user_id: userId, active: true } });
  if (!cart) {
    return { success: false, message: "Your cart is empty.", errors: { cart: ["No active cart"] } };
  }

  // Fetch cart items with product title for order item naming
  const cartItems = await MarketplaceCartItems.findAll({
    where: { marketplace_cart_id: cart.id },
    include: [
      {
        model: db.MarketplaceProduct,
        attributes: ["id", "title"],
      },
    ],
  });
  if (!cartItems.length) {
    return { success: false, message: "Your cart is empty.", errors: { cart: ["No items in cart"] } };
  }

  // Compute totals from cart
  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const tax = Number(cart.tax ?? 0);
  const discount = Number(cart.discount ?? 0);
  const total = subtotal + tax - discount;

  // Derive currency by region with default GHS (Ghana Cedis)
  const ipCountry = getHeaderCountry();
  const derived = deriveCurrencyByCountry(ipCountry);
  const orderCurrency = cart.currency || derived || "GHS";

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
        currency: orderCurrency,
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
          marketplace_product_variation_id: ci.marketplace_product_variation_id || null,
          name: ci.name || ci?.MarketplaceProduct?.title || "Product",
          quantity: ci.quantity,
          price: ci.price,
          subtotal: ci.subtotal || (Number(ci.price) * Number(ci.quantity)).toFixed(2),
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
      amount: Number(order.total),
      currency: order.currency || "GHS",
      customer: { email, firstName, lastName },
    };
  } catch (e) {
    await t.rollback();
    console.error("beginCheckout error", e);
    return { success: false, message: e?.message || "Failed to start checkout" };
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

  const order = await MarketplaceOrder.findOne({ where: { id: orderId, user_id: userId } });
  if (!order) return { success: false, message: "Order not found" };

  const t = await sequelize.transaction();
  try {
    const notes = payloadRaw ? (order.notes ? `${order.notes}\n${payloadRaw}` : payloadRaw) : order.notes;

    if (status === "success") {
      await order.update(
        {
          paymentStatus: "completed",
          orderStatus: "completed",
          paystackReferenceId: reference || order.paystackReferenceId,
          notes,
        },
        { transaction: t }
      );

      // Clear cart
      const cart = await MarketplaceCart.findOne({ where: { user_id: userId, active: true }, transaction: t, lock: t.LOCK.UPDATE });
      if (cart) {
        await MarketplaceCartItems.destroy({ where: { marketplace_cart_id: cart.id }, transaction: t });
        await cart.update({ subtotal: 0, tax: 0, discount: 0, total: 0 }, { transaction: t });
      }

      await t.commit();

      // Send confirmation email (best-effort)
      try {
        if (email) {
          const items = await MarketplaceOrderItems.findAll({ where: { marketplace_order_id: order.id } });
          const products = items.map((it) => ({ name: it.name, quantity: it.quantity, price: Number(it.price), subtotal: Number(it.subtotal) }));
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

      return { success: true, message: "Order completed", orderNumber: order.order_number };
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
    return { success: false, message: "Payment failed", orderNumber: order.order_number };
  } catch (e) {
    await t.rollback();
    console.error("finalizeOrder error", e);
    return { success: false, message: e?.message || "Failed to finalize order" };
  }
}
