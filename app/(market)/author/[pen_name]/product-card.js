"use client";
import React, { useState, useEffect, useActionState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardFooter } from "../../../components/ui/card";
import { Heart, LoaderCircle, ShoppingCart, Star } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { addProductToCart, addProductWishlist } from "./action";
import { useSession } from "next-auth/react";
import { useHome } from "../../../context";
import { Badge } from "../../../components/ui/badge";
import Link from "next/link";

const initialStateValues = {
  message: "",
  errors: {
    productId: [],
  },
};

export default function MyProductCard(props) {
  const { product } = props;
  const { openLoginDialog, refetchWishlistCount, refetchCartCount } = useHome();
  const { data: session } = useSession();
  const [state, formAction, isPending] = useActionState(
    addProductWishlist,
    initialStateValues
  );
  const [cartState, cartFormAction, isCartPending] = useActionState(
    addProductToCart,
    initialStateValues
  );
  const [localWishlistState, setLocalWishlistState] = useState(null);
  const [localCartState, setLocalCartState] = useState(null);
  const [hasLocalCartOverride, setHasLocalCartOverride] = useState(false);

  const discountPercentage = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      )
    : 0;

  const wishes = product?.wishlist?.find(
    (wish) =>
      wish?.user_id === session?.user?.id &&
      wish.marketplace_product_id === product.id
  );

  // Use local state if available, otherwise fall back to server state
  const isWished =
    localWishlistState !== null
      ? localWishlistState
      : typeof wishes === "object";

  const carts = product?.Cart?.find(
    (cart) =>
      cart?.user_id === session?.user?.id &&
      cart.cartItems?.find((item) => item.marketplace_product_id === product.id)
  );

  const isCarted = hasLocalCartOverride
    ? Boolean(localCartState) // If we have a local override, use its boolean value
    : typeof carts === "object"; // Otherwise fall back to server state

  // Update local state when server action completes
  useEffect(() => {
    if (state.success && state.inWishlist !== undefined) {
      setLocalWishlistState(state.inWishlist);
      refetchWishlistCount();
    }
  }, [state, refetchWishlistCount]);

  // Handle cart state responses
  useEffect(() => {
    if (cartState.success && cartState.action) {
      console.log("state cart", cartState);
      // Update local state based on action (added/removed)
      if (cartState.action === "added") {
        setLocalCartState(cartState.cartItem);
        setHasLocalCartOverride(true);
        toast.success(cartState.message || "Item added to cart successfully");
      } else if (cartState.action === "removed") {
        setLocalCartState(null);
        setHasLocalCartOverride(true);
        toast.success(
          cartState.message || "Item removed from cart successfully"
        );
      }

      refetchCartCount();
      console.log(
        "Cart action completed:",
        cartState.action,
        cartState.message
      );
    } else if (cartState.message && !cartState.success) {
      // Show error message
      console.error("Failed to update cart:", cartState.message);
      toast.error(cartState.message);
      // Reset override on error to fall back to server state
      setHasLocalCartOverride(false);
    }
  }, [cartState, refetchCartCount]);

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md hover:-translate-y-1">
      <div className="relative overflow-hidden rounded-t-lg">
        <Image
          src={product.image || "/placeholder-product.png"}
          alt={product.title}
          width={300}
          height={200}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />

        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.featured && (
            <Badge className="bg-purple-500 hover:bg-purple-600 text-white">
              Bestseller
            </Badge>
          )}
          {discountPercentage > 0 && (
            <Badge className="bg-red-500 hover:bg-red-600 text-white">
              -{discountPercentage}%
            </Badge>
          )}
        </div>

        <div className="absolute top-3 right-3">
          <form action={session?.user?.id ? formAction : openLoginDialog}>
            <Button
              variant="ghost"
              size="sm"
              className={`absolute top-2 right-2 h-8 w-8 p-0 transition-all duration-200 z-5 ${
                isWished
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/80 hover:bg-white text-gray-600 hover:text-red-500"
              } ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              type="submit"
              disabled={
                isPending ||
                !session?.user ||
                product?.user_id === session?.user?.id
              }
              title={
                !session?.user
                  ? "Please login to add to wishlist"
                  : isWished
                    ? "Remove from wishlist"
                    : "Add to wishlist"
              }
            >
              <Heart
                className={`h-4 w-4 transition-all duration-200 ${
                  isWished ? "fill-current" : ""
                } ${isPending ? "animate-pulse" : ""}`}
              />
            </Button>
            <input type="hidden" name="productId" value={product.id} />
          </form>
        </div>
        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Link href={`/product/${product.id}`}>
            <Button variant="secondary" size="sm">
              Preview
            </Button>
          </Link>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-1">
          <Link
            href={`/category/${product?.categorySlug}`}
            className="hover:underline"
          >
            {product.category}
          </Link>
        </div>
        <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">
          {product.title}
        </h3>
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">
          {product.description}
        </p>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">
              {product.averageRating || 0}
            </span>
            <span className="text-sm text-slate-500">
              ({product.reviewCount || 0})
            </span>
          </div>
          <div className="text-lg font-bold text-blue-600">
            ${product.price}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0 w-full">
        <form
          action={session?.user?.id ? cartFormAction : openLoginDialog}
          onSubmit={() => {
            // Optimistic update for immediate visual feedback
            if (isCarted) {
              setLocalCartState(null);
              setHasLocalCartOverride(true);
            } else {
              setLocalCartState({
                id: "temp",
                product_id: product.id,
              });
              setHasLocalCartOverride(true);
            }
          }}
          className="w-full"
        >
          <Button
            type="submit"
            className="w-full disabled:cursor-not-allowed text-white"
            size="sm"
            disabled={
              isCartPending || !session || product.user_id === session.user.id
            }
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {isCartPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : isCarted ? (
              "Remove from Cart"
            ) : (
              "Add to Cart"
            )}
          </Button>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="quantity" value="1" />
        </form>
      </CardFooter>
    </Card>
  );
}
