import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { db } from "../../../../../../../models/index";
import { z } from "zod";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../../../lib/security/rateLimit";
import { getRequestIdFromHeaders, reportError } from "../../../../../../../lib/observability/reportError";

const { MarketplaceProduct, MarketplaceCartItems, MarketplaceCart, User } = db;

export const runtime = "nodejs";

// Helper to compute effective price respecting discount expiry
function computeEffectivePrice(product) {
  const priceNum = Number(product.price);
  const originalPriceNum = Number(product.originalPrice);
  const hasDiscount = Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const saleEndMs = product.sale_end_date ? new Date(product.sale_end_date).getTime() : null;
  const isExpired = hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
  return isExpired ? originalPriceNum : priceNum;
}

// Validation schema
const updateCartSchema = z.object({
  action: z.enum(['update_quantity', 'remove_item']),
  quantity: z.number().min(1).optional(),
});

export async function POST(request, { params }) {
  let getParams = null;
  try {
    getParams = await params;
  } catch {
    getParams = null;
  }
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  
  try {
    const { id } = getParams || {}; // This is the cart item ID
    const cartItemId = id == null ? "" : String(id).trim().slice(0, 128);
    if (!cartItemId) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 }
      );
    }
    const body = await request.json().catch(() => ({}));
    
    // Validate request body
    const validationResult = updateCartSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid request data", 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }
    
    const { action, quantity } = validationResult.data;
    
    // Get session to verify user
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `cart-item-update:${userIdForRl}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }
    
    // Find the cart item with cart and user verification
    const cartItem = await MarketplaceCartItems.findOne({
      where: { id: cartItemId },
      include: [
        {
          model: MarketplaceCart,
          include: [
            {
              model: User,
              attributes: ['id', 'pen_name']
            }
          ]
        },
        {
          model: MarketplaceProduct,
          attributes: ['id', 'title', 'price', 'originalPrice', 'sale_end_date', 'currency', 'stock', 'inStock', 'product_status', 'user_id']
        }
      ]
    });
    
    if (!cartItem) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 }
      );
    }
    
    // Verify the user owns this cart
    if (cartItem.MarketplaceCart.User.id !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Block updates if product is not published (unless user is owner)
    const prod = cartItem.MarketplaceProduct;
    const isOwner = prod?.user_id === session.user.id;
    if (!isOwner && prod?.product_status !== 'published') {
      return NextResponse.json(
        { error: "Product is no longer available" },
        { status: 400 }
      );
    }

    const productCurrency = (cartItem?.MarketplaceProduct?.currency || "USD")
      .toString()
      .toUpperCase();
    if (productCurrency !== "USD") {
      return NextResponse.json(
        { error: "Only USD-priced products can be updated in cart" },
        { status: 400 }
      );
    }

    if ((cartItem?.MarketplaceCart?.currency || "").toString().toUpperCase() !== "USD") {
      await cartItem.MarketplaceCart.update({ currency: "USD" });
    }
    
    let updatedItem = null;
    
    if (action === 'remove_item') {
      // Remove the item from cart
      await cartItem.destroy();
      
      // Recalculate cart totals
      await recalculateCartTotals(cartItem.MarketplaceCart.id, {
        requestId,
        userId: session?.user?.id || null,
      });
      
      return NextResponse.json({
        success: true,
        message: "Item removed from cart",
        data: {
          removed_item_id: cartItemId,
          cart_id: cartItem.MarketplaceCart.id
        }
      });
      
    } else if (action === 'update_quantity') {
      if (!quantity) {
        return NextResponse.json(
          { error: "Quantity is required for update_quantity action" },
          { status: 400 }
        );
      }

      // Enforce stock limits
      const prod = cartItem.MarketplaceProduct;
      if (prod?.inStock === false || (prod?.stock !== null && typeof prod?.stock !== 'undefined' && Number(prod.stock) <= 0)) {
        return NextResponse.json(
          { error: "Product is out of stock" },
          { status: 400 }
        );
      }
      if (
        prod?.stock !== null && typeof prod?.stock !== 'undefined' &&
        Number(quantity) > Number(prod.stock)
      ) {
        return NextResponse.json(
          { error: "Requested quantity exceeds available stock" },
          { status: 400 }
        );
      }

      // Update the quantity and price using effective price
      const effectivePrice = computeEffectivePrice(prod);
      const newPrice = effectivePrice * quantity;
      
      updatedItem = await cartItem.update({
        quantity,
        price: newPrice.toFixed(2)
      });
      
      // Recalculate cart totals
      await recalculateCartTotals(cartItem.MarketplaceCart.id, {
        requestId,
        userId: session?.user?.id || null,
      });
      
      return NextResponse.json({
        success: true,
        message: "Cart item updated successfully",
        data: {
          id: updatedItem.id,
          quantity: updatedItem.quantity,
          price: parseFloat(updatedItem.price),
          product: {
            id: cartItem.MarketplaceProduct.id,
            title: cartItem.MarketplaceProduct.title,
            unit_price: parseFloat(cartItem.MarketplaceProduct.price)
          }
        }
      });
    }
    
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/item/[id]/carts/update",
      method: "POST",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "cart_item_update",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: "Internal server error", ...(isProd ? {} : { details: error?.message }) },
      { status: 500 }
    );
  }
}

// Helper function to recalculate cart totals
async function recalculateCartTotals(cartId, ctx) {
  const requestId = ctx?.requestId || null;
  const userId = ctx?.userId || null;
  try {
    const cart = await MarketplaceCart.findByPk(cartId);
    if (!cart) return;
    
    // Get all cart items
    const cartItems = await MarketplaceCartItems.findAll({
      where: { marketplace_cart_id: cartId }
    });
    
    // Calculate new totals
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + parseFloat(item.price);
    }, 0);
    
    const total = subtotal - parseFloat(cart.discount || 0);
    
    // Update cart totals
    await cart.update({
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      currency: "USD",
    });
    
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/item/[id]/carts/update",
      method: "POST",
      status: 200,
      requestId,
      userId,
      tag: "cart_recalculate_totals",
    });
  }
}