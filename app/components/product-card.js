"use client";
import React, {
  useActionState,
  useEffect,
  useState,
  startTransition,
} from "react";
import Image from "next/image";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Heart,
  ShoppingCart,
  Star,
  Download,
  FileText,
  LoaderCircle,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { addProductWishlist, addProductToCart } from "../actions";
import { useHome } from "../context";
import { toast } from "sonner";

const initialStateValues = {
  message: "",
  errors: {
    productId: [],
  },
};

export default function ProductCard(props) {
  const { resource } = props;
  const {
    openLoginDialog,
    refetchWishlistCount,
    refetchCartCount,
    addOptimisticWishlist,
    removeOptimisticWishlist,
    addOptimisticCart,
    removeOptimisticCart,
  } = useHome();
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

  const discountPercentage = resource.originalPrice
    ? Math.round(
        ((resource.originalPrice - resource.price) / resource.originalPrice) *
          100
      )
    : 0;

  // const wishes = resource?.wishlist?.find(
  //   (wish) =>
  //     (wish?.user_id === session?.user?.id) &&
  //     wish.marketplace_product_id === resource.id
  // );

  // const isWished = typeof wishes === "object";

  const wishes = resource?.wishlist?.find(
    (wish) =>
      wish?.user_id === session?.user?.id &&
      wish.marketplace_product_id === resource.id
  );

  // Use local state if available, otherwise fall back to server state
  const isWished =
    localWishlistState !== null
      ? localWishlistState
      : typeof wishes === "object";

  // const carts = resource?.Cart?.find(
  //   (cart) =>
  //     (cart?.user_id === session?.user?.id) &&
  //     cart.cartItems?.find(
  //       (item) => item.marketplace_product_id === resource.id
  //     )
  // );

  // const isCarted = typeof carts === "object";

  const carts = resource?.Cart?.find(
    (cart) =>
      cart?.user_id === session?.user?.id &&
      cart.cartItems?.find(
        (item) => item.marketplace_product_id === resource.id
      )
  );

  const isCarted = hasLocalCartOverride
    ? Boolean(localCartState) // If we have a local override, use its boolean value
    : typeof carts === "object"; // Otherwise fall back to server state

  //

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

  // Combined action functions that wrap optimistic updates in transitions
  const handleWishlistAction = async (formData) => {
    console.log("form data", formData);
    const productId = formData.get("productId");
    if (!session?.user?.id) {
      openLoginDialog();
      return;
    }

    // Apply optimistic update in transition
    //startTransition(() => {
    if (isWished) {
      removeOptimisticWishlist(resource.id);
      console.log("id again..............");
    } else {
      addOptimisticWishlist(resource.id);
      console.log("id again..............");
    }
    //});
    console.log("stage org", state);
    // Call server action (result handled by useEffect)
    return formAction(formData);
  };

  const handleCartAction = async (formData) => {
    if (!session?.user?.id) {
      openLoginDialog();
      return;
    }

    // Apply optimistic update in transition
    startTransition(() => {
      if (isCarted) {
        removeOptimisticCart(resource.id);
      } else {
        addOptimisticCart(resource.id);
      }
    });

    // Call server action (result handled by useEffect)
    return cartFormAction(formData);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-sm">
      <CardContent className="p-0">
        {/* Image Container */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg bg-gradient-to-br from-purple-50 to-pink-50">
          <Image
            src={resource.image || "/placeholder.svg"}
            alt={resource.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {resource.featured && (
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

          {/* Wishlist Button */}
          {/* <form action={handleWishlistAction}>
            <Button
              variant="ghost"
              size="sm"
              className={`absolute top-2 right-2 h-8 w-8 p-0 transition-all duration-200 z-5 ${
                isWished
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/80 hover:bg-white text-gray-600 hover:text-red-500"
              }`}
              type="submit"
              disabled={
                
                !session?.user ||
                resource?.user_id === session?.user?.id
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
                }`}
              />
            </Button>
            <input type="hidden" name="productId" value={resource.id} />
          </form> */}

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
                resource?.user_id === session?.user?.id
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
            <input type="hidden" name="productId" value={resource.id} />
          </form>

          {/* Quick Actions Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Link href={`/product/${resource.id}`}>
              <Button variant="secondary" size="sm">
                Preview
              </Button>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category */}
          <div className="text-xs text-muted-foreground mb-1">
            {resource.MarketplaceCategory?.name} ›{" "}
            {resource.MarketplaceSubCategory?.name}
          </div>

          {/* Title */}
          <Link href={`/product/${resource.id}`}>
            <h3 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-purple-600 cursor-pointer">
              {resource.title}
            </h3>
          </Link>

          {/* Author */}
          <div className="flex items-center gap-1 mb-2">
            <Link href={`/author/${resource?.User?.pen_name}`}>
              <span className="text-xs text-purple-600 hover:underline cursor-pointer">
                {resource.User?.name}
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <span title="Rating">{resource?.rating}</span>{" "}
                <span title="Reviews">({resource?.reviewCount})</span>
              </span>
            </div>
          </div>

          {/* Rating & Reviews */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.floor(resource?.rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground" title="Rating">
              ({resource?.rating})
            </span>
          </div>

          {/* Features */}
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span>{resource?.deliveryTime}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>{resource?.fileType}</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold">${resource?.price}</span>
            {resource?.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                ${resource?.originalPrice}
              </span>
            )}
          </div>

          {/* Add to Cart Button */}
          {/* <form action={handleCartAction}
          >
            <Button
              type="submit"
              className="w-full disabled:cursor-not-allowed"
              size="sm"
              disabled={
                isCartPending ||
                !session ||
                resource.user_id === session.user.id
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
            <input type="hidden" name="productId" value={resource.id} />
            <input type="hidden" name="quantity" value="1" />
          </form> */}

          <form
            action={session?.user?.id ? cartFormAction : openLoginDialog}
            onSubmit={() => {
              // Optimistic update for immediate visual feedback
              if (isCarted) {
                setLocalCartState(null);
                setHasLocalCartOverride(true);
              } else {
                setLocalCartState({ id: "temp", product_id: resource.id });
                setHasLocalCartOverride(true);
              }
            }}
          >
            <Button
              type="submit"
              className="w-full disabled:cursor-not-allowed"
              size="sm"
              disabled={
                isCartPending ||
                !session ||
                resource.user_id === session.user.id
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
            <input type="hidden" name="productId" value={resource.id} />
            <input type="hidden" name="quantity" value="1" />
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
