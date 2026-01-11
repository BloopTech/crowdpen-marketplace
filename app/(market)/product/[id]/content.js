"use client";

import React, { useState, useEffect, useActionState, useMemo } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../../../components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import {
  Star,
  Download,
  FileText,
  ShoppingCart,
  Heart,
  Share2,
  CheckCircle,
  Users,
  LoaderCircle,
  Ellipsis,
  Info,
} from "lucide-react";
import MarketplaceHeader from "../../../components/marketplace-header";
import ImageGalleryModal from "../../../components/ui/image-gallery-modal";
import Link from "next/link";
import { useProductItemContext } from "./context";
import { addProductWishlist, addProductToCart, deleteOrArchiveProductItem } from "./action";
import ProductDetails from "./details";
import { useHome } from "../../../context";
import { useSession } from "next-auth/react";
import { reportClientError } from "../../../lib/observability/reportClientError";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";
import RelatedProducts from "./related";
import { Badge } from "../../../components/ui/badge";
import { useViewerCurrency } from "../../../hooks/use-viewer-currency";
import { trackFunnelEvent } from "../../../lib/funnelEventsClient";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { useRouter } from "next/navigation";

const initialStateValues = {
  message: "",
  errors: {
    productId: [],
  },
};

export default function ProductDetailContent(props) {
  const { productItemData, productItemLoading, shareProduct, isCopied } =
    useProductItemContext();
  const { openLoginDialog, refetchWishlistCount, refetchCartCount } = useHome();
  const router = useRouter();
  const { id } = props;
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { data: session } = useSession();
  const [state, formAction, isPending] = useActionState(
    addProductWishlist,
    initialStateValues
  );
  const [cartState, cartFormAction, isCartPending] = useActionState(
    addProductToCart,
    initialStateValues
  );
  const deleteInitialState = useMemo(
    () => ({ success: false, message: "", errors: {}, action: null }),
    []
  );
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteOrArchiveProductItem,
    deleteInitialState
  );
  const [localWishlistState, setLocalWishlistState] = useState(null);
  const [localCartState, setLocalCartState] = useState(null);
  const [hasLocalCartOverride, setHasLocalCartOverride] = useState(false);

  useEffect(() => {
    if (!productItemData?.id) return;
    trackFunnelEvent({
      event_name: "product_view",
      marketplace_product_id: productItemData.id,
      metadata: {
        currency: (productItemData?.currency || "USD").toString().toUpperCase(),
      },
    });
  }, [productItemData?.id, productItemData?.currency]);

  const productCurrency = (productItemData?.currency || "USD")
    .toString()
    .toUpperCase();

  const { viewerCurrency, viewerFxRate } = useViewerCurrency(productCurrency);

  const wishes = productItemData?.wishlist?.find(
    (wish) =>
      wish?.user_id === session?.user?.id &&
      wish.marketplace_product_id === productItemData.id
  );

  // Use local state if available, otherwise fall back to server state
  const isWished =
    localWishlistState !== null
      ? localWishlistState
      : typeof wishes === "object";

  const carts = productItemData?.Cart?.find(
    (cart) =>
      cart?.user_id === session?.user?.id &&
      cart.cartItems?.find(
        (item) => item.marketplace_product_id === productItemData.id
      )
  );

  const isCarted = hasLocalCartOverride
    ? Boolean(localCartState) // If we have a local override, use its boolean value
    : typeof carts === "object"; // Otherwise fall back to server state

  // Update local state when server action completes
  useEffect(() => {
    if (state.success && state.inWishlist !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalCartState(cartState.cartItem);
        setHasLocalCartOverride(true);
        toast.success(cartState.message || "Item added to cart successfully");

        trackFunnelEvent({
          event_name: "add_to_cart",
          marketplace_product_id: productItemData?.id || null,
          metadata: {
            quantity: 1,
            cartItemId: cartState?.cartItem?.id || null,
          },
        });
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
          typeof cartState.message === "string" && cartState.message
            ? cartState.message
            : "Failed to update cart";
        await reportClientError(new Error(msg), {
          tag: "product_detail_cart_update_error",
        });
      })();
      toast.error(cartState.message);
      // Reset override on error to fall back to server state
      setHasLocalCartOverride(false);
    }
  }, [cartState, refetchCartCount, productItemData?.id]);

  useEffect(() => {
    if (!deleteState?.message) return;
    if (deleteState?.success) {
      toast.success(deleteState.message);
      const tid = setTimeout(() => {
        setIsDeleteDialogOpen(false);
      }, 0);

      if (deleteState?.action === "deleted") {
        router.push("/account?tab=my-products");
      } else {
        router.refresh();
      }

      return () => clearTimeout(tid);
    }

    toast.error(deleteState.message);
  }, [deleteState, router]);

  // Early returns for loading/error states
  if (!id) {
    return notFound();
  }

  if (productItemLoading) {
    return (
      <div className="flex w-full items-center justify-center flex-col space-y-16 my-[2rem]">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  }

  if (!productItemData && !productItemLoading) {
    return notFound();
  }

  const ownerCanDelete = Boolean(productItemData?.canDelete);
  const deleteDialogTitle = ownerCanDelete ? "Delete product?" : "Archive product?";
  const deleteDialogDescription = ownerCanDelete
    ? "This will permanently delete this product. This action cannot be undone."
    : "This product can’t be deleted because it has reviews or orders. Archiving will remove it from the marketplace, but keep it available for tracking.";
  const deleteDialogActionLabel = ownerCanDelete ? "Delete" : "Archive";

  const priceNum = Number(productItemData?.price ?? 0);
  const originalPriceNum = Number(productItemData?.originalPrice ?? 0);
  const hasDiscount =
    Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: productCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedPrice = currencyFormatter.format(priceNum);
  const formattedOriginal = hasDiscount
    ? currencyFormatter.format(originalPriceNum)
    : null;
  const saveAmount = hasDiscount ? originalPriceNum - priceNum : 0;
  const formattedSave = hasDiscount
    ? currencyFormatter.format(saveAmount)
    : null;
  const savePercent = hasDiscount
    ? Math.round((saveAmount / originalPriceNum) * 100)
    : 0;
  const isOutOfStock =
    productItemData?.inStock === false ||
    (productItemData?.stock !== null &&
      typeof productItemData?.stock !== "undefined" &&
      Number(productItemData?.stock) <= 0);

  const displayCurrency = (viewerCurrency || productCurrency)
    .toString()
    .toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const showConverted = displayCurrency !== productCurrency && displayRate !== 1;
  const displayFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const displayFormattedPrice = displayFormatter.format(priceNum * displayRate);
  const displayFormattedOriginal = hasDiscount
    ? displayFormatter.format(originalPriceNum * displayRate)
    : null;
  const displayFormattedSave = hasDiscount
    ? displayFormatter.format((originalPriceNum - priceNum) * displayRate)
    : null;

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      <div className="min-h-screen bg-background w-full">
        <MarketplaceHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={() => {}}
          cartItemCount={cartItems.length}
        />

        <div className="mx-auto md:px-10 px-5 py-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Product Images */}
            <div className="space-y-4">
              <div className="aspect-[3/4] relative overflow-hidden rounded-lg bg-gradient-to-br from-muted to-accent">
                <Image
                  src={
                    productItemData?.images[selectedImage] || "/placeholder.svg"
                  }
                  alt={productItemData?.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
              {productItemData.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {productItemData?.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedImage(index);
                        setIsGalleryOpen(true);
                      }}
                      className={`relative w-20 h-24 rounded-md overflow-hidden border-2 flex-shrink-0 hover:opacity-80 transition-opacity ${
                        selectedImage === index
                          ? "border-tertiary"
                          : "border-border"
                      }`}
                    >
                      <Image
                        src={image || "/placeholder.svg"}
                        alt={`${productItemData.title} ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6 w-full">
              <div className="w-full">
                <div className="text-sm text-muted-foreground mb-2">
                  <Link
                    href={`/category/${productItemData?.MarketplaceCategory?.slug}`}
                    className="hover:underline"
                  >
                    {productItemData?.MarketplaceCategory?.name} ›{" "}
                    {productItemData?.MarketplaceSubCategory?.name}
                  </Link>
                </div>
                <div className="flex items-center space-x-4 w-full">
                  <h1 className="text-3xl font-bold mb-4 w-[85%]">
                    {productItemData?.title}
                  </h1>

                  {session?.user?.id === productItemData?.user_id ? (
                    <div className="flex justify-end items-center w-[10%]">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="outline-none cursor-pointer">
                          <Ellipsis className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="z-20 overflow-y-auto w-36">
                          <DropdownMenuItem>
                            <Link
                              href={`/product/edit/${productItemData?.id}`}
                              className="w-full"
                            >
                              <div
                                className={`flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                              >
                                Edit
                              </div>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setIsDeleteDialogOpen(true);
                            }}
                            disabled={isDeletePending}
                          >
                            <div
                              className={`flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                            >
                              Delete
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </div>

                {/* Author Info */}
                <div>
                  <Link href={`/author/${productItemData?.User?.pen_name}`}>
                    <div className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-accent p-2 rounded-lg -m-2">
                      <Avatar
                        color={productItemData?.User?.color}
                        imageUrl={productItemData?.User?.image}
                        initials={productItemData?.User?.name.charAt(0)}
                      >
                        <AvatarFallback>
                          {productItemData?.User?.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-foreground hover:text-tertiary">
                          {productItemData?.User?.name}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>
                            {productItemData?.authorRating} (
                            {productItemData?.authorSales} sales)
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.floor(productItemData.rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300 dark:text-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {productItemData.rating} ({productItemData?.reviewCount}{" "}
                    reviews)
                  </span>
                </div>
              </div>
              {/* Price */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {displayFormattedPrice}
                  </span>
                </div>
                {showConverted ? (
                  <div className="text-sm text-muted-foreground">
                    ≈ {formattedPrice}
                  </div>
                ) : null}
                <div className="text-sm">
                  {isOutOfStock ? (
                    <Badge className="bg-gray-800/90 text-white text-sm">
                      Out of stock
                    </Badge>
                  ) : (
                    typeof productItemData?.stock !== "undefined" &&
                    productItemData?.stock !== null && (
                      <span className="text-muted-foreground">
                        In stock: {productItemData?.stock}
                      </span>
                    )
                  )}
                </div>
                {hasDiscount && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span>
                        RRP{" "}
                        <span className="line-through">
                          {displayFormattedOriginal}
                        </span>
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Recommended Retail Price information"
                            className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
                          >
                            <Info className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="center"
                          sideOffset={6}
                          className="z-[9999]"
                        >
                          Recommended Retail Price before discounts.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                      Save {displayFormattedSave} ({savePercent}% OFF)
                    </div>
                  </div>
                )}
                <div className="border-t border-border" />
              </div>

              {/* Variations */}
              {productItemData?.variations && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Choose your package:
                  </label>
                  {productItemData.variations.map((variation, index) => (
                    <div
                      key={variation.id}
                      className={`p-3 border rounded-lg cursor-pointer ${
                        selectedVariation === index
                          ? "border-tertiary bg-tertiary/10"
                          : "border-border"
                      }`}
                      onClick={() => setSelectedVariation(index)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{variation.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {variation.description}
                          </div>
                        </div>
                        <div className="font-bold">
                          {displayFormatter.format(
                            Number(variation.price || 0) * displayRate
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
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
                        product_id: productItemData.id,
                      });
                      setHasLocalCartOverride(true);
                    }
                  }}
                  className="w-full"
                >
                  <Button
                    type="submit"
                    className="w-full disabled:cursor-not-allowed"
                    size="lg"
                    disabled={
                      isCartPending ||
                      productItemData?.user_id === session?.user?.id ||
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
                  <input
                    type="hidden"
                    name="productId"
                    value={productItemData.id}
                  />
                  <input type="hidden" name="quantity" value="1" />
                </form>

                <div className="flex gap-2">
                  <form
                    action={formAction}
                    onSubmit={(e) => {
                      if (!session?.user?.id) {
                        e.preventDefault();
                        openLoginDialog("login");
                      }
                    }}
                  >
                    <Button
                      variant="outline"
                      size="lg"
                      className={`flex-1 transition-all duration-200 ${
                        isWished
                          ? "bg-red-500 hover:bg-red-600 text-white"
                          : "bg-background/80 hover:bg-background text-muted-foreground hover:text-red-500"
                      } ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      type="submit"
                      disabled={
                        isPending ||
                        productItemData?.user_id === session?.user?.id
                      }
                    >
                      <Heart
                        className={`h-4 w-4 transition-all duration-200 ${
                          isWished ? "fill-current" : ""
                        } ${isPending ? "animate-pulse" : ""}`}
                      />
                    </Button>
                    <input
                      type="hidden"
                      name="productId"
                      value={productItemData.id}
                    />
                  </form>
                  <Button
                    onClick={shareProduct}
                    variant="outline"
                    size="lg"
                    className="flex-1 cursor-pointer"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    {isCopied ? "Copied!" : "Share"}
                  </Button>
                </div>
              </div>

              {/* Product Features */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    {productItemData.deliveryTime}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{productItemData.fileType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">{productItemData.license}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">
                    {productItemData?.downloads} downloads
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Details Tabs */}
          <ProductDetails />

          {/* Related Products */}
          <RelatedProducts />
        </div>

        {/* Image Gallery Modal */}
        <ImageGalleryModal
          images={productItemData?.images || []}
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
          initialIndex={selectedImage}
          productTitle={productItemData?.title || ""}
        />

        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            if (isDeletePending) return;
            setIsDeleteDialogOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{deleteDialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletePending}>Cancel</AlertDialogCancel>
              <form action={deleteFormAction}>
                <input type="hidden" name="productId" value={productItemData?.id || ""} />
                <Button
                  type="submit"
                  variant={ownerCanDelete ? "destructive" : "default"}
                  size="sm"
                  disabled={isDeletePending || !productItemData?.id}
                >
                  {isDeletePending ? (
                    <span className="inline-flex items-center">
                      <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                      {deleteDialogActionLabel}...
                    </span>
                  ) : (
                    deleteDialogActionLabel
                  )}
                </Button>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
