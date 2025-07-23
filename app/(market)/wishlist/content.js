"use client";

import React, { useState, useActionState, useEffect } from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import {
  Heart,
  ShoppingCart,
  ArrowLeft,
  Trash2,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Loader2,
  ShoppingBag,
  X,
  RefreshCw,
} from "lucide-react";
import MarketplaceHeader from "../../components/marketplace-header";
import ProductCard from "../../components/product-card";
import { addAllProductsCarts, clearAllWishlist } from "./actions";
import { useHome } from "../../context";
import { useWishlistContext } from "./context";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

const initialStateValues = {
  message: "",
  errors: {
    productId: [],
  },
};

export default function WishlistContent() {
  const { openLoginDialog, refetchWishlistCount, refetchCartCount } = useHome();
  const {
    products,
    totalItems,
    user,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    search,
    category,
    sortBy,
    sortOrder,
    minPrice,
    maxPrice,
    setSearch,
    setCategory,
    setSortBy,
    setSortOrder,
    setMinPrice,
    setMaxPrice,
    clearFilters,
    addAllToCart,
    clearWishlist,
    isAddingToCart,
    isClearingWishlist,
  } = useWishlistContext();
  const { data: session } = useSession();

  const [state, formAction, isPending] = useActionState(
    addAllProductsCarts,
    initialStateValues
  );
  const [wishlistState, wishlistFormAction, wishlistIsPending] = useActionState(
    clearAllWishlist,
    initialStateValues
  );

  const [showFilters, setShowFilters] = useState(false);

  // Update local state when server action completes
  useEffect(() => {
    if (wishlistState.success && wishlistState.data) {
      toast.success(wishlistState.message);
      refetchWishlistCount();
    } else if (!wishlistState.success && wishlistState.message) {
      toast.error(wishlistState.message);
    }
  }, [wishlistState, refetchWishlistCount]);

  useEffect(() => {
    if (state.success && state.data) {
      toast.success(state.message);
      refetchCartCount();
    } else if (!state.success && state.message) {
      toast.error(state.message);
    }
  }, [state, refetchCartCount]);

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MarketplaceHeader />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Please log in to view your wishlist.
              </p>
              <Button onClick={openLoginDialog} className="w-full">
                Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Browse
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Wishlist</h1>
              <p className="text-gray-600">
                {isLoading ? "Loading..." : `${totalItems} items saved`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Filter & Sort</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search products..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="templates">Templates</SelectItem>
                      <SelectItem value="graphics">Graphics</SelectItem>
                      <SelectItem value="fonts">Fonts</SelectItem>
                      <SelectItem value="icons">Icons</SelectItem>
                      <SelectItem value="photos">Photos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort by</label>
                  <Select
                    value={`${sortBy}-${sortOrder}`}
                    onValueChange={(value) => {
                      const [field, order] = value.split("-");
                      setSortBy(field);
                      setSortOrder(order);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at-desc">
                        Newest first
                      </SelectItem>
                      <SelectItem value="created_at-asc">
                        Oldest first
                      </SelectItem>
                      <SelectItem value="price-asc">
                        Price: Low to High
                      </SelectItem>
                      <SelectItem value="price-desc">
                        Price: High to Low
                      </SelectItem>
                      <SelectItem value="title-asc">Name: A to Z</SelectItem>
                      <SelectItem value="title-desc">Name: Z to A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price Range</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minPrice || ""}
                      onChange={(e) =>
                        setMinPrice(parseFloat(e.target.value) || 0)
                      }
                      className="w-20"
                    />
                    <span className="self-center">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPrice === 10000 ? "" : maxPrice}
                      onChange={(e) =>
                        setMaxPrice(parseFloat(e.target.value) || 10000)
                      }
                      className="w-20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <div className="text-sm text-gray-600">
                  {products.length} of {totalItems} products shown
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Bar */}
        {products.length > 0 && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="px-3 py-1">
                    {products.length} items
                  </Badge>
                  {(search || category || minPrice > 0 || maxPrice < 10000) && (
                    <Badge variant="outline">Filtered results</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <form
                    action={session?.user?.id ? formAction : openLoginDialog}
                  >
                    {/* Pass product IDs as JSON string */}
                    <input
                      type="hidden"
                      name="productIds"
                      value={JSON.stringify(products.map((p) => p.id))}
                    />
                    <Button
                      variant="outline"
                      type="submit"
                      disabled={
                        isAddingToCart || products.length === 0 || isPending
                      }
                    >
                      {isAddingToCart || isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShoppingBag className="h-4 w-4 mr-2" />
                      )}
                      Add All to Cart
                    </Button>
                  </form>

                  <form
                    action={
                      session?.user?.id ? wishlistFormAction : openLoginDialog
                    }
                  >
                    {/* Optional confirmation flag */}
                    <input type="hidden" name="confirm" value="true" />
                    <Button
                      variant="destructive"
                      type="submit"
                      disabled={
                        isClearingWishlist ||
                        products.length === 0 ||
                        wishlistIsPending
                      }
                    >
                      {isClearingWishlist || wishlistIsPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Clear Wishlist
                    </Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {isError && (
          <Card className="mb-6 border-red-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-red-600">
                <X className="h-4 w-4" />
                <span>Error loading wishlist: {error?.message}</span>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-t-lg" />
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && products.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Heart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {search || category
                  ? "No matching items"
                  : "Your wishlist is empty"}
              </h3>
              <p className="text-gray-600 mb-6">
                {search || category
                  ? "Try adjusting your filters to see more items."
                  : "Start browsing and add items you love to your wishlist."}
              </p>
              <div className="flex gap-2 justify-center">
                {(search || category) && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
                <Link href="/">
                  <Button>Browse Products</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        {!isLoading && products.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard resource={product} key={product.id} />
              ))}
            </div>

            {/* Load More */}
            {hasNextPage && (
              <div className="text-center mt-8">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    "Load More Products"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
