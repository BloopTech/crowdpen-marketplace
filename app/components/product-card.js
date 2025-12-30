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
  Crown,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { addProductWishlist, addProductToCart } from "../actions";
import { useHome } from "../context";
import { toast } from "sonner";
import { StatusPill } from "./status-pill";
import { useViewerCurrency } from "../hooks/use-viewer-currency";

const initialStateValues = {
  message: "",
  errors: {
    productId: [],
  },
};

export default function ProductCard(props) {
  const { resource, viewMode = "grid" } = props;
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

  const isOutOfStock =
    resource?.inStock === false ||
    (resource?.stock !== null &&
      typeof resource?.stock !== "undefined" &&
      Number(resource?.stock) <= 0);

  const baseCurrency = (resource?.currency || "USD").toString().toUpperCase();
  const { viewerCurrency, viewerFxRate } = useViewerCurrency(baseCurrency);
  const displayCurrency = (viewerCurrency || baseCurrency)
    .toString()
    .toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const fmt = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0) * displayRate);

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

  const initialWished = typeof wishes === "object";
  const serverWished =
    session?.user?.id &&
    !isPending &&
    state?.success &&
    typeof state?.inWishlist !== "undefined"
      ? state.inWishlist
      : undefined;
  const hasWishlistActionError =
    session?.user?.id &&
    !isPending &&
    state?.success === false &&
    state?.message;

  // Use local state if available, otherwise fall back to server state
  const isWished = !session?.user?.id
    ? false
    : typeof serverWished === "boolean"
      ? serverWished
      : hasWishlistActionError
        ? initialWished
        : localWishlistState !== null
          ? localWishlistState
          : initialWished;

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

  const initialCarted = typeof carts === "object";
  const serverCarted =
    session?.user?.id &&
    !isCartPending &&
    cartState?.success &&
    cartState?.action
      ? cartState.action === "added"
      : undefined;
  const hasCartActionError =
    session?.user?.id &&
    !isCartPending &&
    cartState?.success === false &&
    cartState?.message;

  const isCarted = !session?.user?.id
    ? false
    : typeof serverCarted === "boolean"
      ? serverCarted
      : hasCartActionError
        ? initialCarted
        : hasLocalCartOverride
          ? Boolean(localCartState) // If we have a local override, use its boolean value
          : initialCarted; // Otherwise fall back to server state

  //

  // Update local state when server action completes
  useEffect(() => {
    if (
      !isPending &&
      state?.success &&
      typeof state?.inWishlist !== "undefined"
    ) {
      refetchWishlistCount();
    }
  }, [state, isPending, refetchWishlistCount]);

  // Handle cart state responses
  useEffect(() => {
    if (!isCartPending && cartState?.success && cartState?.action) {
      if (cartState.action === "added") {
        toast.success(cartState.message || "Item added to cart successfully");
      } else if (cartState.action === "removed") {
        toast.success(
          cartState.message || "Item removed from cart successfully"
        );
      }

      refetchCartCount();
    }
    if (
      !isCartPending &&
      cartState?.success === false &&
      cartState?.message
    ) {
      // Show error message
      console.error("Failed to update cart:", cartState?.message);
      toast.error(cartState?.message);
    }
  }, [cartState, isCartPending, refetchCartCount]);

  // Combined action functions that wrap optimistic updates in transitions
  const handleWishlistAction = async (formData) => {
    if (!session?.user?.id) {
      openLoginDialog();
      return;
    }

    setLocalWishlistState(!isWished);

    // Apply optimistic update in transition
    //startTransition(() => {
    if (isWished) {
      removeOptimisticWishlist(resource.id);
    } else {
      addOptimisticWishlist(resource.id);
    }
    //});
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

  // List view layout
  if (viewMode === "list") {
    return (
      <Card className="group hover:shadow-lg transition-all duration-300 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row gap-4 p-4">
            {/* Image */}
            <div className="relative w-full sm:w-48 h-48 sm:h-36 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-muted to-accent">
              <Image
                src={resource.image || "/placeholder.svg"}
                alt={resource.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 100vw, 192px"
              />
              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-2">
                {resource.featured && (
                  <StatusPill icon={Sparkles} label="Featured" className="bg-purple-500/90 backdrop-blur text-xs" />
                )}
                {resource.isBestseller && (
                  <StatusPill icon={Crown} label="Bestseller" className="bg-amber-500/90 backdrop-blur text-xs" />
                )}
                {discountPercentage > 0 && (
                  <Badge className="!bg-red-500 hover:!bg-red-600 !text-white text-xs">-{discountPercentage}%</Badge>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                {/* Category */}
                <div className="text-xs text-muted-foreground mb-1">
                  <Link href={`/category/${resource.MarketplaceCategory?.slug}`} className="hover:underline">
                    {resource.MarketplaceCategory?.name} › {resource.MarketplaceSubCategory?.name}
                  </Link>
                </div>

                {/* Title */}
                <Link href={`/product/${resource.product_id || resource.id}`}>
                  <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-tertiary cursor-pointer">
                    {resource.title}
                  </h3>
                </Link>

                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2 hidden sm:block">
                  {resource.description}
                </p>

                {/* Author & Rating */}
                <div className="flex items-center gap-3 mb-2">
                  <Link href={`/author/${resource?.User?.pen_name}`}>
                    <span className="text-sm text-foreground hover:text-tertiary hover:underline cursor-pointer">
                      by {resource.User?.name}
                    </span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-muted-foreground">{resource?.rating} ({resource?.reviewCount})</span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    <span>{resource?.deliveryTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>{resource?.fileType}</span>
                  </div>
                  {isOutOfStock && (
                    <Badge className="bg-red-800/90 text-white text-xs">Out of stock</Badge>
                  )}
                </div>
              </div>

              {/* Price & Actions */}
              <div className="flex items-center justify-between mt-3 gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">{fmt(resource?.price)}</span>
                  {resource?.originalPrice && discountPercentage > 0 && (
                    <span className="text-sm text-muted-foreground line-through">{fmt(resource?.originalPrice)}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <form action={handleWishlistAction}>
                    <Button
                      variant="outline"
                      size="sm"
                      type="submit"
                      disabled={isPending || !session?.user || resource?.user_id === session?.user?.id}
                      className={isPending ? "opacity-50" : ""}
                    >
                      <Heart className={`h-4 w-4 ${isWished ? "fill-red-500 text-red-500" : ""}`} />
                    </Button>
                    <input type="hidden" name="productId" value={resource.id} />
                  </form>

                  <form action={handleCartAction} onSubmit={() => {
                    if (isCarted) {
                      setLocalCartState(null);
                      setHasLocalCartOverride(true);
                    } else {
                      setLocalCartState({ id: "temp", product_id: resource.id });
                      setHasLocalCartOverride(true);
                    }
                  }}>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isCartPending || !session || resource.user_id === session?.user?.id}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {isCartPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isCarted ? "Remove" : "Add to Cart"}
                    </Button>
                    <input type="hidden" name="productId" value={resource.id} />
                    <input type="hidden" name="quantity" value="1" />
                  </form>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view layout (default)
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 shadow-sm">
      <CardContent className="p-0">
        {/* Image Container */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg bg-gradient-to-br from-muted to-accent">
          <Image
            src={resource.image || "/placeholder.svg"}
            alt={resource.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority
          />

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            {resource.featured && (
              <StatusPill
                icon={Sparkles}
                label="Featured"
                className="bg-purple-500/90 backdrop-blur"
              />
            )}
            {resource.isBestseller && (
              <StatusPill
                icon={Crown}
                label="Bestseller"
                className="bg-amber-500/90 backdrop-blur"
              />
            )}
            {discountPercentage > 0 && (
              <Badge className="!bg-red-500 hover:!bg-red-600 !text-white">
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

          <form action={handleWishlistAction}>
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
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
            <Link
              href={`/product/${resource.product_id ? resource.product_id : resource.id}`}
            >
              <Button
                variant="secondary"
                size="sm"
                className="pointer-events-auto"
              >
                Preview
              </Button>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category */}
          <div className="text-xs text-muted-foreground mb-1">
            <Link
              href={`/category/${resource.MarketplaceCategory?.slug}`}
              className="hover:underline"
            >
              {resource.MarketplaceCategory?.name} ›{" "}
              {resource.MarketplaceSubCategory?.name}
            </Link>
          </div>

          {/* Title */}
          <Link
            href={`/product/${resource.product_id ? resource.product_id : resource.id}`}
          >
            <h3 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-tertiary cursor-pointer">
              {resource.title}
            </h3>
          </Link>

          {/* Author */}
          <div className="flex items-center gap-1 mb-2">
            <Link href={`/author/${resource?.User?.pen_name}`}>
              <span className="text-xs text-foreground hover:text-tertiary hover:underline cursor-pointer">
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
                      : "text-gray-300 dark:text-gray-600"
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
            <span className="text-lg font-bold">{fmt(resource?.price)}</span>
            {resource?.originalPrice && discountPercentage > 0 && (
              <span className="text-sm text-muted-foreground line-through">
                {fmt(resource?.originalPrice)}
              </span>
            )}
          </div>
          <div className="text-xs mb-3">
            {isOutOfStock ? (
              <Badge className="bg-red-800/90 text-white text-xs">
                Out of stock
              </Badge>
            ) : typeof resource?.stock !== "undefined" &&
              resource?.stock !== null ? (
              `In stock: ${resource?.stock}`
            ) : null}
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
                resource.user_id === session.user.id ||
                isOutOfStock
              }
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isCartPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : isCarted ? (
                "Remove from Cart"
              ) : isOutOfStock ? (
                "Out of Stock"
              ) : (
                "Add to Cart"
              )}
            </Button>
            <input type="hidden" name="productId" value={resource.id} />
            <input type="hidden" name="quantity" value="1" />
          </form> */}

          <form
            action={handleCartAction}
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
                resource.user_id === session.user.id ||
                isOutOfStock  
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
