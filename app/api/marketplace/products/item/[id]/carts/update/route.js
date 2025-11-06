import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { db } from "../../../../../../../models/index";
import { z } from "zod";

const { MarketplaceProduct, MarketplaceCartItems, MarketplaceCart, User } = db;

// Validation schema
const updateCartSchema = z.object({
  action: z.enum(['update_quantity', 'remove_item']),
  quantity: z.number().min(1).optional(),
});

export async function POST(request, { params }) {
  const getParams = await params;
  
  try {
    const { id } = getParams; // This is the cart item ID
    const body = await request.json();
    
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Find the cart item with cart and user verification
    const cartItem = await MarketplaceCartItems.findOne({
      where: { id },
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
          attributes: ['id', 'title', 'price', 'stock', 'inStock']
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
    
    let updatedItem = null;
    
    if (action === 'remove_item') {
      // Remove the item from cart
      await cartItem.destroy();
      
      // Recalculate cart totals
      await recalculateCartTotals(cartItem.MarketplaceCart.id);
      
      return NextResponse.json({
        success: true,
        message: "Item removed from cart",
        data: {
          removed_item_id: id,
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

      // Update the quantity and price
      const newPrice = parseFloat(cartItem.MarketplaceProduct.price) * quantity;
      
      updatedItem = await cartItem.update({
        quantity,
        price: newPrice.toFixed(2)
      });
      
      // Recalculate cart totals
      await recalculateCartTotals(cartItem.MarketplaceCart.id);
      
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
    console.error("Cart Update API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to recalculate cart totals
async function recalculateCartTotals(cartId) {
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
    
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax - parseFloat(cart.discount || 0);
    
    // Update cart totals
    await cart.update({
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2)
    });
    
  } catch (error) {
    console.error("Error recalculating cart totals:", error);
  }
}