"use client";
import React from "react";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  User,
  Loader2,
  Upload,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";
import { useAccount } from "../context";



export default function MyProducts() {
      const {
        // My Products from context (tanstack query)
        myProducts,
        myProductsTotal,
        myProductsHasMore,
        myProductsLoading,
        myProductsLoadingMore,
        myProductsError,
        loadMoreMyProducts,
        // Filters/sort
        myProductsSearch,
        setMyProductsSearch,
        myProductsSelectedCategory,
        setMyProductsSelectedCategory,
        myProductsSortBy,
        setMyProductsSortBy,
        categories,
      } = useAccount();


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              My Products ({myProductsTotal || myProducts.length})
            </span>
            <Link href="/product/create">
              <Button size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Create Product
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Search products..."
              value={myProductsSearch}
              onChange={(e) => setMyProductsSearch(e.target.value)}
              className="md:flex-1"
            />
            <Select
              value={myProductsSelectedCategory}
              onValueChange={setMyProductsSelectedCategory}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={myProductsSortBy}
              onValueChange={setMyProductsSortBy}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="sales">Most Popular</SelectItem>
                <SelectItem value="bestsellers">Bestsellers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {myProductsError ? (
            <div className="text-sm text-red-600 mb-4">{myProductsError}</div>
          ) : null}

          {myProductsLoading && myProducts.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your products...
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {myProducts.map((p) => (
              <div
                key={p.id}
                className="flex flex-col border border-border rounded-lg p-3"
              >
                <div className="relative aspect-[3/2] bg-muted rounded overflow-hidden mb-3">
                  <NextImage
                    src={p.image || "/placeholder.svg"}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  {p.category || ""}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2">
                  {p.title}
                </h3>
                <div className="text-sm text-foreground mt-2">${p.price}</div>
                <div className="text-xs mt-1">
                  {p?.inStock === false ||
                  (p?.stock !== null &&
                    typeof p?.stock !== "undefined" &&
                    Number(p?.stock) <= 0) ? (
                    <Badge className="bg-red-800/90 text-white text-xs">
                      Out of stock
                    </Badge>
                  ) : typeof p?.stock !== "undefined" && p?.stock !== null ? (
                    `In stock: ${p?.stock}`
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/product/${p.id}`}>
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                  </Link>
                  <Link href={`/product/edit/${p.id}`}>
                    <Button size="sm">
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {!myProductsLoading && myProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                You have not created any products yet.
              </p>
              <Link href="/product/create">
                <Button size="sm">Create your first product</Button>
              </Link>
            </div>
          ) : null}

          <div className="flex justify-center mt-6">
            {myProductsHasMore ? (
              <Button
                onClick={() => loadMoreMyProducts?.()}
                disabled={myProductsLoadingMore}
                variant="outline"
              >
                {myProductsLoadingMore ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  "Load More"
                )}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
