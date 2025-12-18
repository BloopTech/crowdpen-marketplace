import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { db } from "../../../../../../models/index";

const { MarketplaceProduct, MarketplaceCartItems, MarketplaceCart, User, MarketplaceKycVerification } = db;

export async function POST(request, { params }) {
  const getParams = await params;

  try {
    const body = await request.json();
    const { quantity = 1, user_id } = body;

    const productId = getParams.id;

    // Validate input
    if (!productId) {
      return NextResponse.json(
        { status: "error", message: "Product ID is required" },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { status: "error", message: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Require session and verify user_id matches

    if (!user_id) {
      return NextResponse.json(
        { status: "error", message: "Invalid user authentication" },
        { status: 403 }
      );
    }

    // Check if product exists and load owner's KYC status
    const product = await MarketplaceProduct.findByPk(productId, {
      include: [
        {
          model: User,
          attributes: ["id"],
          include: [
            { model: MarketplaceKycVerification, attributes: ["status"], required: false },
          ],
        },
      ],
    });
    if (!product) {
      return NextResponse.json(
        { status: "error", message: "Product not found" },
        { status: 404 }
      );
    }

    // // Check if product is active
    // if (!product.active) {
    //   return NextResponse.json(
    //     { status: "error", message: "Product is not available" },
    //     { status: 400 }
    //   );
    // }

    // KYC gating: only allow if viewer is owner or owner's KYC is approved
    const isOwner = product.user_id === user_id;
    const ownerApproved = product?.User?.MarketplaceKycVerification?.status === 'approved';
    if (!isOwner && !ownerApproved) {
      return NextResponse.json(
        { status: "error", message: "Product is not available" },
        { status: 403 }
      );
    }

    // Prevent add when product is out of stock
    if (product?.inStock === false || (product?.stock !== null && typeof product?.stock !== 'undefined' && Number(product.stock) <= 0)) {
      return NextResponse.json(
        { status: "error", message: "Product is out of stock" },
        { status: 400 }
      );
    }

    // Prevent add when requested quantity exceeds available stock (if tracked)
    if (
      typeof quantity === 'number' &&
      product?.stock !== null && typeof product?.stock !== 'undefined' &&
      Number(quantity) > Number(product.stock)
    ) {
      return NextResponse.json(
        { status: "error", message: "Requested quantity exceeds available stock" },
        { status: 400 }
      );
    }

    // Find or create user's active cart
    let cart = await MarketplaceCart.findOne({
      where: {
        user_id,
        active: true,
      },
    });

    if (!cart) {
      cart = await MarketplaceCart.create({
        user_id,
        active: true,
        subtotal: 0.0,
        discount: 0.0,
        tax: 0.0,
        total: 0.0,
        currency: "USD",
      });
    }

    const productCurrency = (product?.currency || "USD").toString().toUpperCase();
    if (productCurrency !== "USD") {
      return NextResponse.json(
        {
          status: "error",
          message: "Only USD-priced products can be added to cart",
        },
        { status: 400 }
      );
    }
    if ((cart?.currency || "").toString().toUpperCase() !== "USD") {
      await cart.update({ currency: "USD" });
    }

    // Check if item already exists in cart
    let cartItem = await MarketplaceCartItems.findOne({
      where: {
        marketplace_cart_id: cart.id,
        marketplace_product_id: productId,
      },
    });

    if (cartItem) {
      // Item exists, remove it from cart (toggle off)
      await cartItem.destroy();
      
      // Check if cart is now empty and remove it if so
      const remainingItems = await MarketplaceCartItems.count({
        where: {
          marketplace_cart_id: cart.id,
        },
      });
      
      if (remainingItems === 0) {
        await cart.destroy();
      } else {
        // Update cart totals after removal
        const cartItems = await MarketplaceCartItems.findAll({
          where: {
            marketplace_cart_id: cart.id,
          },
        });
        
        const subtotal = cartItems.reduce((sum, item) => {
          return sum + parseFloat(item.price || 0);
        }, 0);
        
        cart.subtotal = subtotal;
        cart.total = subtotal + parseFloat(cart.tax || 0) - parseFloat(cart.discount || 0);
        await cart.save();
      }
      
      return NextResponse.json({
        status: "success",
        message: "Item removed from cart successfully",
        action: "removed",
        cartItem: null,
      });
    } else {
      // Item doesn't exist, add it to cart (toggle on)
      const itemSubtotal = parseFloat(product.price) * quantity;
      cartItem = await MarketplaceCartItems.create({
        marketplace_cart_id: cart.id,
        marketplace_product_id: productId,
        quantity: quantity,
        price: itemSubtotal,
        subtotal: itemSubtotal,
      });
    }

    // Update cart totals
    const cartItems = await MarketplaceCartItems.findAll({
      where: {
        marketplace_cart_id: cart.id,
      },
    });

    const subtotal = cartItems.reduce((sum, item) => {
      return sum + parseFloat(item.price || 0);
    }, 0);

    cart.subtotal = subtotal;
    cart.total =
      subtotal + parseFloat(cart.tax || 0) - parseFloat(cart.discount || 0);
    await cart.save();

    // Return success response with cart item data
    return NextResponse.json({
      status: "success",
      message: "Item added to cart successfully",
      action: "added",
      cartItem: {
        id: cartItem.id,
        product_id: cartItem.marketplace_product_id,
        quantity: cartItem.quantity,
        price: cartItem.price,
      },
      cart: {
        id: cart.id,
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cartItems.length,
        currency: "USD",
      },
    });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
