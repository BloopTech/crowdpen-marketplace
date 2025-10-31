"use client";

import React, { useState, useEffect, useActionState } from "react";
import { notFound, useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
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
  Award,
  LoaderCircle,
  Ellipsis,
  Info,
} from "lucide-react";
import MarketplaceHeader from "../../../components/marketplace-header";
import ImageGalleryModal from "../../../components/ui/image-gallery-modal";
import Link from "next/link";
import { useProductItemContext } from "./context";
import { addProductWishlist, addProductToCart } from "./action";
import ProductDetails from "./details";
import { useHome } from "../../../context";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";
import RelatedProducts from "./related";

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
  const { id } = props;
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
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

  const priceNum = Number(productItemData?.price ?? 0);
  const originalPriceNum = Number(productItemData?.originalPrice ?? 0);
  const hasDiscount =
    Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      <div className="min-h-screen bg-gray-50 w-full">
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
            <div className="aspect-[3/4] relative overflow-hidden rounded-lg bg-gradient-to-br from-purple-50 to-pink-50">
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
                        ? "border-purple-500"
                        : "border-gray-200"
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
                      <DropdownMenuContent className="z-20 overflow-y-auto bg-white w-36">
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
                        <DropdownMenuItem>
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
                  <div className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg -m-2">
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
                      <div className="font-semibold text-black hover:text-[#d3a155]">
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
                          : "text-gray-300"
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
                  {formattedPrice}
                </span>
              </div>
              {hasDiscount && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>
                      RRP{" "}
                      <span className="line-through">{formattedOriginal}</span>
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Recommended Retail Price information"
                          className="rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
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
                  <div className="text-sm text-emerald-700 font-medium">
                    Save {formattedSave} ({savePercent}% OFF)
                  </div>
                </div>
              )}
              <div className="border-t border-gray-200" />
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
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200"
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
                      <div className="font-bold">${variation.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
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
                      product_id: productItemData.id,
                    });
                    setHasLocalCartOverride(true);
                  }
                }}
                className="w-full"
              >
                <Button
                  type="submit"
                  className="w-full disabled:cursor-not-allowed text-white"
                  size="lg"
                  disabled={
                    isCartPending ||
                    !session ||
                    productItemData.user_id === session.user.id
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
                <form action={session?.user?.id ? formAction : openLoginDialog}>
                  <Button
                    variant="outline"
                    size="lg"
                    className={`flex-1 transition-all duration-200 ${
                      isWished
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-white/80 hover:bg-white text-gray-600 hover:text-red-500"
                    } ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    type="submit"
                    disabled={
                      isPending ||
                      !session?.user ||
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
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-green-600" />
                <span className="text-sm">{productItemData.deliveryTime}</span>
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
      </div>
    </TooltipProvider>
  );
}
