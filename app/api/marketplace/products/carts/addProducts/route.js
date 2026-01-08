import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../lib/security/rateLimit";

const { MarketplaceCart, MarketplaceCartItems, MarketplaceProduct, User, MarketplaceKycVerification } = db;

// Helper to compute effective price respecting discount expiry
function computeEffectivePrice(product) {
  const priceNum = Number(product.price);
  const originalPriceNum = Number(product.originalPrice);
  const hasDiscount = Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const saleEndMs = product.sale_end_date ? new Date(product.sale_end_date).getTime() : null;
  const isExpired = hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
  return isExpired ? originalPriceNum : priceNum;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const productIdsRaw = body?.productIds;
    const bodyUserId = body?.userId;

    const productIds = Array.isArray(productIdsRaw)
      ? productIdsRaw
          .map((v) => (v == null ? "" : String(v).trim()))
          .filter((v) => v)
          .slice(0, 50)
      : null;

    if (productIds && productIds.some((id) => id.length > 128)) {
      return NextResponse.json(
        { error: "Invalid product IDs" },
        { status: 400 }
      );
    }

    if (!productIds || productIds.length === 0) {
      return NextResponse.json(
        { error: "Product IDs array is required" },
        { status: 400 }
      );
    }

    if (productIds.length > 50) {
      return NextResponse.json(
        { error: "Too many product IDs" },
        { status: 400 }
      );
    }

    // Require session and ensure it matches userId
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `cart-add-products:${userIdForRl}:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    if (bodyUserId != null && String(bodyUserId).slice(0, 128) !== String(session.user.id)) {
      return NextResponse.json(
        { error: "Invalid user authentication" },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Find user
    const user = await User.findOne({
      where: { id: userId },
      attributes: ['id']
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find or create user's cart
    let [cart] = await MarketplaceCart.findOrCreate({
      where: { 
        user_id: user.id,
        active: true 
      },
      defaults: {
        user_id: user.id,
        subtotal: 0,
        total: 0,
        currency: "USD",
        active: true
      }
    });

    if ((cart?.currency || "").toString().toUpperCase() !== "USD") {
      await cart.update({ currency: "USD" });
    }

    // Get products to add including owner KYC status for gating
    const products = await MarketplaceProduct.findAll({
      where: { id: productIds },
      attributes: ['id', 'title', 'price', 'originalPrice', 'sale_end_date', 'currency', 'user_id', 'stock', 'inStock', 'product_status'],
      include: [
        {
          model: User,
          attributes: ['id', 'role', 'crowdpen_staff', 'merchant'],
          include: [
            { model: MarketplaceKycVerification, attributes: ['status'], required: false },
          ],
        },
      ],
    });

    if (products.length === 0) {
      return NextResponse.json(
        { error: "No valid products found" },
        { status: 404 }
      );
    }

    let addedCount = 0;
    let totalAmount = 0;
    const addedProducts = [];
    const skippedProducts = [];

    const cartCurrency = "USD";

    // Add each product to cart
    for (const product of products) {
      const productCurrency = (product?.currency || "USD").toString().toUpperCase();

      if (productCurrency !== cartCurrency) {
        skippedProducts.push({
          id: product.id,
          title: product.title,
          reason: 'Different currency',
        });
        continue;
      }

      // Product status gating - skip non-published products (unless owner)
      const isOwnerForStatus = product.user_id === session.user.id;
      if (!isOwnerForStatus && product.product_status !== 'published') {
        skippedProducts.push({
          id: product.id,
          title: product.title,
          reason: 'Product is not available',
        });
        continue;
      }

      // Per-product KYC gating
      const isOwner = product.user_id === session.user.id;
      const ownerApproved =
        product?.User?.MarketplaceKycVerification?.status === 'approved' ||
        User.isKycExempt(product?.User) ||
        product?.User?.merchant === true;
      if (!isOwner && !ownerApproved) {
        skippedProducts.push({
          id: product.id,
          title: product.title,
          reason: 'Product is not available',
        });
        continue;
      }

      // Stock gating
      if (product?.inStock === false || (product?.stock !== null && typeof product?.stock !== 'undefined' && Number(product.stock) <= 0)) {
        skippedProducts.push({
          id: product.id,
          title: product.title,
          reason: 'Out of stock',
        });
        continue;
      }

      // Check if product is already in cart
      const existingCartItem = await MarketplaceCartItems.findOne({
        where: {
          marketplace_cart_id: cart.id,
          marketplace_product_id: product.id
        }
      });

      if (!existingCartItem) {
        // Add new item to cart using effective price
        const effectivePrice = computeEffectivePrice(product);
        await MarketplaceCartItems.create({
          marketplace_cart_id: cart.id,
          marketplace_product_id: product.id,
          quantity: 1,
          price: effectivePrice,
          subtotal: effectivePrice
        });
        
        addedCount++;
        totalAmount += effectivePrice;
        addedProducts.push({
          id: product.id,
          title: product.title,
          price: effectivePrice
        });
      } else {
        skippedProducts.push({
          id: product.id,
          title: product.title,
          reason: 'Already in cart'
        });
      }
    }

    // Update cart totals
    if (addedCount > 0) {
      const newSubtotal = parseFloat(cart.subtotal) + totalAmount;
      await cart.update({
        subtotal: newSubtotal,
        total: newSubtotal - parseFloat(cart.discount || 0)
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedCount} products to cart`,
      data: {
        addedCount,
        totalAmount,
        skippedCount: skippedProducts.length,
        addedProducts,
        skippedProducts,
        cartId: cart.id
      }
    });

  } catch (error) {
    console.error('Add products to cart API error:', error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: "Internal server error", ...(isProd ? {} : { details: error?.message }) },
      { status: 500 }
    );
  }
}