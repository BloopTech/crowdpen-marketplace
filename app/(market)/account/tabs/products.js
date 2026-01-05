"use client";
import React, { useActionState, useEffect, useMemo, useState } from "react";
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
  FileText,
  Archive,
  Globe,
  AlertCircle,
  Flag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";
import { useAccount } from "../context";
import { useViewerCurrency } from "../../../hooks/use-viewer-currency";
import { deleteOrArchiveProduct } from "../action";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";



export default function MyProducts() {
  const queryClient = useQueryClient();
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
        myProductsStatus,
        setMyProductsStatus,
        categories,
        profile,
        kyc,
      } = useAccount();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const initialDeleteState = useMemo(
    () => ({ success: false, message: "", errors: {}, action: null }),
    []
  );
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteOrArchiveProduct,
    initialDeleteState
  );

  useEffect(() => {
    if (!deleteState?.message) return;
    if (deleteState?.success) {
      toast.success(deleteState.message);
      queryClient.invalidateQueries({ queryKey: ["account", "my-products"], exact: false });
      const tid = setTimeout(() => {
        setIsConfirmOpen(false);
        setSelectedProduct(null);
      }, 0);
      return () => clearTimeout(tid);
    }

    toast.error(deleteState.message);
  }, [deleteState, queryClient]);

  const isKycExempt = Boolean(
    profile?.crowdpen_staff === true ||
      profile?.role === "admin" ||
      profile?.role === "senior_admin"
  );
  const hasApprovedKyc =
    isKycExempt ||
    profile?.merchant === true ||
    kyc?.status === "approved";

  const getStatusBadge = (status) => {
    if (status === "published" && !hasApprovedKyc) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 cursor-help">
                <AlertCircle className="h-3 w-3 mr-1" />Pending KYC
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <div>Complete verification to make this product visible on the marketplace.</div>
                <Link href="/account?tab=verification" className="underline">
                  Go to Verification
                </Link>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    switch (status) {
      case 'published':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"><Globe className="h-3 w-3 mr-1" />Published</Badge>;
      case 'archived':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400"><Archive className="h-3 w-3 mr-1" />Archived</Badge>;
      case 'draft':
      default:
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
    }
  };

  const { viewerCurrency, viewerFxRate } = useViewerCurrency("USD");
  const displayCurrency = (viewerCurrency || "USD").toString().toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const showConverted = displayCurrency !== "USD" && displayRate !== 1;

  const fmtOriginal = (currency, v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toString().toUpperCase(),
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  const fmtViewerFromUsd = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0) * displayRate);

  const selectedIsDeletable = Boolean(selectedProduct?.canDelete);
  const confirmTitle = selectedIsDeletable
    ? "Delete product?"
    : "Archive product?";
  const confirmDescription = selectedIsDeletable
    ? "This will permanently delete this product. This action cannot be undone."
    : "This product can’t be deleted because it has reviews or orders. Archiving will remove it from the marketplace, but keep it available for tracking.";
  const confirmActionLabel = selectedIsDeletable ? "Delete" : "Archive";


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
              value={myProductsStatus || 'all'}
              onValueChange={setMyProductsStatus}
            >
              <SelectTrigger className="w-full md:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
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
                <div className="relative aspect-3/2 bg-muted rounded overflow-hidden mb-3">
                  <NextImage
                    src={p.image || "/placeholder.svg"}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  {p?.flagged ? (
                    <div className="absolute top-2 left-2 flex flex-col gap-2">
                      <Badge className="bg-red-600/95 text-white shadow-lg flex items-center gap-1 text-xs">
                        <Flag className="h-3 w-3" />
                        Flagged
                      </Badge>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs text-muted-foreground">{p.category || ""}</span>
                  <div className="flex items-center gap-1">
                    {getStatusBadge(p.product_status)}
                  </div>
                </div>
                <h3 className="font-semibold text-sm line-clamp-2">
                  {p.title}
                </h3>
                <div className="text-sm text-foreground mt-2">
                  <div className="flex flex-col leading-tight">
                    <span>{fmtOriginal(p.currency, p.price)}</span>
                    {showConverted &&
                    (p?.currency || "USD").toString().toUpperCase() ===
                      "USD" ? (
                      <span className="text-[11px] text-muted-foreground">
                        ≈ {fmtViewerFromUsd(p.price)}
                      </span>
                    ) : null}
                  </div>
                </div>
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
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setIsConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
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

      <AlertDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          setIsConfirmOpen(open);
          if (!open) setSelectedProduct(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Cancel</AlertDialogCancel>
            <form action={deleteFormAction}>
              <input
                type="hidden"
                name="productId"
                value={selectedProduct?.product_id || selectedProduct?.id || ""}
              />
              <AlertDialogAction
                type="submit"
                disabled={isDeletePending || !selectedProduct?.id}
                className={
                  selectedIsDeletable
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
              >
                {confirmActionLabel}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
