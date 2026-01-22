"use client";
import React, { useState, useEffect, useActionState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardFooter } from "../../../components/ui/card";
import {
  Heart,
  LoaderCircle,
  ShoppingCart,
  Star,
  Sparkles,
  Crown,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { addProductToCart, addProductWishlist } from "./action";
import { useSession } from "next-auth/react";
import { useHome } from "../../../context";
import { reportClientError } from "../../../lib/observability/reportClientError";
import { Badge } from "../../../components/ui/badge";
import Link from "next/link";
import { StatusPill } from "../../../components/status-pill";
import { useViewerCurrency } from "../../../hooks/use-viewer-currency";
import { htmlToText } from "../../../lib/sanitizeHtml";

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
  const baseCurrency = (product?.currency || "USD").toString().toUpperCase();
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
  const [state, formAction, isPending] = useActionState(
    addProductWishlist,
    initialStateValues
  );
  const [cartState, cartFormAction, isCartPending] = useActionState(
    addProductToCart,
    initialStateValues
  );
  const [localCartState, setLocalCartState] = useState(null);
  const [hasLocalCartOverride, setHasLocalCartOverride] = useState(false);

  const discountPercentage = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      )
    : 0;

  const isOutOfStock =
    product?.inStock === false ||
    (product?.stock !== null &&
      typeof product?.stock !== "undefined" &&
      Number(product?.stock) <= 0);
  const testId = `author-product-card-${product.id}`;

  const wishes = product?.wishlist?.find(
    (wish) =>
      wish?.user_id === session?.user?.id &&
      wish.marketplace_product_id === product.id
  );

  // Use action state if available, otherwise fall back to server state
  const isWished =
    state.success && state.inWishlist !== undefined
      ? state.inWishlist
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
      refetchWishlistCount();
    }
  }, [state, refetchWishlistCount]);

  // Handle cart state responses
  useEffect(() => {
    if (cartState.success && cartState.action) {
      console.log("state cart", cartState);
      // Update local state based on action (added/removed)
      if (cartState.action === "added") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
      void (async () => {
        const msg =
          typeof cartState?.message === "string" && cartState.message
            ? cartState.message
            : "Failed to update cart";
        await reportClientError(new Error(msg), {
          tag: "author_product_card_cart_update_error",
        });
      })();
      toast.error(cartState.message);
      // Reset override on error to fall back to server state
      setHasLocalCartOverride(false);
    }
  }, [cartState, refetchCartCount]);

  return (
    <Card
      className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md hover:-translate-y-1"
      data-testid={testId}
      data-product-id={product.id}
    >
      <div className="relative overflow-hidden rounded-t-lg">
        <Image
          src={product.image || "/placeholder.svg"}
          alt={product.title}
          width={300}
          height={200}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          priority
        />

        <div className="absolute top-2 left-2 flex flex-col gap-2">
          {product.featured && (
            <StatusPill
              icon={Sparkles}
              label="Featured"
              className="bg-purple-500/90 backdrop-blur"
            />
          )}
          {product.isBestseller && (
            <StatusPill
              icon={Crown}
              label="Bestseller"
              className="bg-amber-500/90 backdrop-blur"
            />
          )}
          {discountPercentage > 0 && (
            <Badge className="bg-red-500! hover:bg-red-600! text-white!">
              -{discountPercentage}%
            </Badge>
          )}
        </div>

        <div className="absolute top-1 right-2">
          <form
            action={formAction}
            onSubmit={(e) => {
              if (!session?.user?.id) {
                e.preventDefault();
                openLoginDialog("login");
              }
            }}
            data-testid={`${testId}-wishlist-form`}
          >
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
                product?.user_id === session?.user?.id
              }
              data-testid={`${testId}-wishlist`}
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
          <Link
            href={`/product/${product.product_id ? product.product_id : product.id}`}
            data-testid={`${testId}-preview`}
          >
            <Button
              variant="secondary"
              size="sm"
              data-testid={`${testId}-preview-button`}
            >
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
            data-testid={`${testId}-category`}
          >
            {product.category} › {product?.subCategory}
          </Link>
        </div>
        <h3
          className="font-semibold text-lg mb-2 line-clamp-2"
          data-testid={`${testId}-title`}
        >
          {product.title}
        </h3>
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">
          {htmlToText(product.description)}
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
          <div className="text-lg font-bold text-primary">
            {fmt(product.price)}
          </div>
        </div>
        <div className="text-xs mb-2">
          {isOutOfStock ? (
            <Badge className="bg-red-800/90 text-white text-xs">
              Out of stock
            </Badge>
          ) : typeof product?.stock !== "undefined" &&
            product?.stock !== null ? (
            `In stock: ${product?.stock}`
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="pt-0 w-full">
        <form
          action={cartFormAction}
          onSubmit={(e) => {
            if (!session?.user?.id) {
              e.preventDefault();
              openLoginDialog("login");
              return;
            }

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
          data-testid={`${testId}-cart-form`}
        >
          <Button
            type="submit"
            className="w-full disabled:cursor-not-allowed"
            size="sm"
            disabled={
              isCartPending ||
              product?.user_id === session?.user?.id ||
              isOutOfStock
            }
            data-testid={`${testId}-cart`}
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
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="quantity" value="1" />
        </form>
      </CardFooter>
    </Card>
  );
}
