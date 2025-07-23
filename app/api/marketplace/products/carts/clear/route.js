import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { db } from "../../../../../models/index";
import { z } from "zod";

const { MarketplaceCart, MarketplaceCartItems, User } = db;

// Validation schema
const clearCartSchema = z.object({
  penName: z.string().min(1),
});

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = clearCartSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid request data", 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }
    
    const { penName } = validationResult.data;
    
    // Get session to verify user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Verify the user is clearing their own cart
    if (session.user.pen_name !== penName) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    
    // Find user's cart
    const cart = await MarketplaceCart.findOne({
      where: {
        user_id: session.user.id,
        active: true
      }
    });
    
    if (!cart) {
      return NextResponse.json({
        success: true,
        message: "Cart is already empty",
        data: { clearedCount: 0 }
      });
    }
    
    // Remove all cart items
    const deletedCount = await MarketplaceCartItems.destroy({
      where: { marketplace_cart_id: cart.id }
    });
    
    // Reset cart totals
    await cart.update({
      subtotal: 0.00,
      discount: 0.00,
      tax: 0.00,
      total: 0.00
    });
    
    return NextResponse.json({
      success: true,
      message: `Removed ${deletedCount} items from cart`,
      data: {
        clearedCount: deletedCount
      }
    });
    
  } catch (error) {
    console.error("Clear Cart API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
