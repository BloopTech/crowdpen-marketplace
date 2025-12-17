import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";

const { MarketplaceCart, MarketplaceCartItems, MarketplaceProduct, User, MarketplaceKycVerification } = db;

export async function POST(request) {
  try {
    const { productIds, userId } = await request.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "Product IDs array is required" },
        { status: 400 }
      );
    }

    // Require session and ensure it matches userId
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (session.user.id !== userId) {
      return NextResponse.json({ error: "Invalid user authentication" }, { status: 403 });
    }

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
        active: true
      }
    });

    // Get products to add including owner KYC status for gating
    const products = await MarketplaceProduct.findAll({
      where: { id: productIds },
      attributes: ['id', 'title', 'price', 'currency', 'user_id', 'stock', 'inStock'],
      include: [
        {
          model: User,
          attributes: ['id'],
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

    let cartCurrency = (cart?.currency || "").toString().toUpperCase();

    // Add each product to cart
    for (const product of products) {
      const productCurrency = (product?.currency || "USD").toString().toUpperCase();

      if (cartCurrency && cartCurrency !== productCurrency) {
        skippedProducts.push({
          id: product.id,
          title: product.title,
          reason: 'Different currency',
        });
        continue;
      }

      // Per-product KYC gating
      const isOwner = product.user_id === session.user.id;
      const ownerApproved = product?.User?.MarketplaceKycVerification?.status === 'approved';
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
        // Add new item to cart
        await MarketplaceCartItems.create({
          marketplace_cart_id: cart.id,
          marketplace_product_id: product.id,
          quantity: 1,
          price: product.price,
          subtotal: product.price
        });

        if (!cartCurrency) {
          cartCurrency = productCurrency;
          await cart.update({ currency: cartCurrency });
        }
        
        addedCount++;
        totalAmount += parseFloat(product.price);
        addedProducts.push({
          id: product.id,
          title: product.title,
          price: product.price
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
      await cart.update({
        subtotal: parseFloat(cart.subtotal) + totalAmount,
        total: parseFloat(cart.total) + totalAmount
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
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}