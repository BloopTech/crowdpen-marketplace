"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowLeft,
  Search,
  Filter,
  Loader2,
  ShoppingCart,
  Star,
} from "lucide-react";
import MarketplaceHeader from "../../components/marketplace-header";
import { useCart } from "./context";
import { useHome } from "../../context";
import { useSession } from "next-auth/react";

export default function CartContent() {
  const { openLoginDialog } = useHome();
  const [promoCode, setPromoCode] = useState("");

  // Use cart context with TanStack Query
  const {
    cartItems,
    cartSummary,
    pagination,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    updateQuantity,
    removeItem,
    loadMore,
    refetch,
    isUpdating,
    isRemoving,
    search,
    setSearch,
    category,
    setCategory,
    sort,
    setSort,
    order,
    setOrder,
  } = useCart();

  const { data: session } = useSession();

  // Handle quantity updates with debouncing
  const handleQuantityChange = (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    updateQuantity(itemId, newQuantity);
  };

  // Handle item removal
  const handleRemoveItem = (itemId) => {
    removeItem(itemId);
  };

  // Show login prompt if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MarketplaceHeader
          searchQuery={search}
          onSearchChange={setSearch}
          onSearch={() => { }}
          cartItemCount={0}
        />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-4">
              Sign in to view your cart
            </h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to access your shopping cart and saved items.
            </p>
            <Button onClick={() => openLoginDialog(true)} size="lg">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={search}
        onSearchChange={setSearch}
        onSearch={() => { }}
        cartItemCount={Array.isArray(cartItems) ? cartItems.length : 0}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Continue Shopping
              </Button>
            </Link>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cart items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-64"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <p className="font-semibold">Error loading cart</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error?.message || "Failed to load cart items"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="mt-3"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Shopping Cart
                  </div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {cartSummary?.item_count || 0} items
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Loading State */}
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex gap-4 p-4 border border-slate-300 rounded-lg">
                        <Skeleton className="w-20 h-24 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      Your cart is empty
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {search
                        ? "No items match your search."
                        : "Add some amazing resources to get started!"}
                    </p>
                    <div className="flex gap-3 justify-center">
                      {search && (
                        <Button variant="outline" onClick={() => setSearch("")}>
                          Clear Search
                        </Button>
                      )}
                      <Link href="/">
                        <Button>Browse Marketplace</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(cartItems) &&
                      cartItems
                        .filter((item) => item && item.product)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex gap-4 p-4 border border-slate-300 rounded-lg hover:shadow-sm transition-shadow"
                          >
                            <div className="relative w-20 h-24 shrink-0 rounded-md overflow-hidden bg-gray-100">
                              <Image
                                src={item.product?.image || "/placeholder.svg"}
                                alt={item.product?.title || "Product"}
                                fill
                                className="object-cover"
                                priority
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-semibold text-lg mb-1 truncate">
                                    <Link
                                      href={`/product/${item?.product?.id}`}
                                    >
                                      {item.product?.title}
                                    </Link>
                                  </h3>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    by{" "}
                                    <Link
                                      href={`/author/${item?.product?.author?.pen_name}`}
                                    >
                                      <span className="text-xs text-purple-600 hover:underline cursor-pointer">
                                        {item?.product?.author?.name}
                                      </span>
                                    </Link>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">
                                    ${(Number(item?.price) || 0).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    $
                                    {(
                                      Number(item?.product?.price) || 0
                                    ).toFixed(2)}{" "}
                                    each
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mb-3">
                                {item.product?.category && (
                                  <Badge
                                    className="text-xs"
                                  >
                                    {item.product.category.name}
                                  </Badge>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>
                                    {item.product?.file_type || "Unknown"}
                                  </span>
                                  {item.product?.rating
                                    ? item.product.rating > 0 && (
                                      <>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                          <span>
                                            {Number(
                                              item.product.rating
                                            ).toFixed(1)}
                                          </span>
                                        </div>
                                      </>
                                    )
                                    : null}
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleQuantityChange(
                                        item.id,
                                        (item.quantity || 1) - 1
                                      )
                                    }
                                    disabled={
                                      isUpdating || (item.quantity || 1) <= 1
                                    }
                                    className="h-8 w-8 p-0"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">
                                    {item.quantity || 1}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleQuantityChange(
                                        item.id,
                                        (item.quantity || 1) + 1
                                      )
                                    }
                                    disabled={isUpdating}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.id)}
                                  disabled={isRemoving}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  {isRemoving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}

                    {/* Load More Button */}
                    {hasNextPage && (
                      <div className="text-center pt-4">
                        <Button
                          variant="outline"
                          onClick={loadMore}
                          disabled={isFetchingNextPage}
                          className="w-full"
                        >
                          {isFetchingNextPage ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Loading more items...
                            </>
                          ) : (
                            `Load More (${Math.max(0, (pagination?.total || 0) - (Array.isArray(cartItems) ? cartItems.length : 0))} remaining)`
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                ) : cartSummary ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${Number(cartSummary?.subtotal).toFixed(2)}</span>
                    </div>
                    {cartSummary?.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>
                          -${Number(cartSummary?.discount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tax (10%)</span>
                      <span>${Number(cartSummary?.tax).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>${Number(cartSummary?.total).toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>$0.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>$0.00</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>$0.00</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    disabled={isLoading || !cartSummary}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isLoading || !cartSummary || !promoCode.trim()}
                  >
                    Apply Code
                  </Button>
                </div>

                <Link href="/checkout">
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={
                      isLoading || cartItems.length === 0 || !cartSummary
                    }
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      "Proceed to Checkout"
                    )}
                  </Button>
                </Link>

                <div className="text-xs text-muted-foreground text-center">
                  Secure checkout • Instant download • 30-day money-back
                  guarantee
                </div>
              </CardContent>
            </Card>

            {/* Trust Badges */}
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium">Why shop with us?</div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>✓ Instant download after purchase</div>
                    <div>✓ 30-day money-back guarantee</div>
                    <div>✓ Secure payment processing</div>
                    <div>✓ 24/7 customer support</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
