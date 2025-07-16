import { NextResponse } from "next/server";
import { db } from "../../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";

const { MarketplaceWishlists, MarketplaceProduct } = db;

/**
 * GET handler to check if a product is in user's wishlist
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response with wishlist status
 */
export async function GET(request, { params }) {
  try {
    // Get current user from session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        status: "error", 
        message: "Authentication required",
        inWishlist: false
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    const productId = params.id;
    
    if (!productId) {
      return NextResponse.json({ 
        status: "error", 
        message: "Product ID is required",
        inWishlist: false
      }, { status: 400 });
    }
    
    // Check if product is in wishlist
    const wishlistItem = await db.MarketplaceWishlists.findOne({
      where: {
        user_id: userId,
        marketplace_product_id: productId
      }
    });
    
    return NextResponse.json({
      status: "success",
      inWishlist: !!wishlistItem
    });
  } catch (error) {
    console.error("Error checking wishlist status:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to check wishlist status",
        inWishlist: false
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler to toggle a product in user's wishlist
 * @param {Request} request - The request object
 * @param {Object} context - The context containing params with product ID
 * @returns {NextResponse} - JSON response indicating success or error
 */
export async function POST(request, { params }) {
  try {
    // Get current user from session
    // const session = await getServerSession(authOptions);
    
    // if (!session || !session.user) {
    //   return NextResponse.json({ 
    //     status: "error", 
    //     message: "You must be logged in to manage your wishlist" 
    //   }, { status: 401 });
    // }
    
    const userId = "2012239a-0286-4026-8ed5-24cb41997b92";
    const productId = params.id;
    
    if (!productId) {
      return NextResponse.json({ 
        status: "error", 
        message: "Product ID is required" 
      }, { status: 400 });
    }
    
    // Check if product exists
    const product = await MarketplaceProduct.findByPk(productId);
    if (!product) {
      return NextResponse.json({ 
        status: "error", 
        message: "Product not found" 
      }, { status: 404 });
    }
    
    // Check if product is already in wishlist
    const existingWishlistItem = await MarketplaceWishlists.findOne({
      where: {
        user_id: userId,
        marketplace_product_id: productId
      }
    });
    
    if (existingWishlistItem) {
      // Remove from wishlist
      await existingWishlistItem.destroy();
      return NextResponse.json({
        status: "success",
        message: "Product removed from wishlist",
        inWishlist: false
      }, { status: 200 });
    } else {
      // Add to wishlist
      await MarketplaceWishlists.create({
        user_id: userId,
        marketplace_product_id: productId
      });
      return NextResponse.json({
        status: "success",
        message: "Product added to wishlist",
        inWishlist: true
      }, { status: 200 });
    }
  } catch (error) {
    console.error("Error managing wishlist:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to update wishlist",
      },
      { status: 500 }
    );
  }
}