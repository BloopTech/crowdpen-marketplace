"use client";

import React, { useState, useEffect, useActionState } from "react";
import { notFound, useParams } from "next/navigation";
import Image from "next/image";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
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
} from "lucide-react";
import { mockResources } from "../../../lib/data";
import MarketplaceHeader from "../../../components/marketplace-header";
import Link from "next/link";
import { useProductItemContext } from "./context";
import { addProductWishlist } from "./action";

const initialStateValues = {
  message: "",
  errors: {
    productId: [],
  },
};

export default function ProductDetailContent(props) {
  const { productItemData, productItemLoading, shareProduct, isCopied } =
    useProductItemContext();
  const { id } = props;
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [state, formAction, isPending] = useActionState(
    addProductWishlist,
    initialStateValues
  );

  const handleAddToCart = () => {
    if (!productItemData) return;
    setCartItems((prev) => [...prev, productItemData.id]);
  };

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

  const reviews = [
    {
      id: "1",
      userName: "Sarah M.",
      rating: 5,
      comment:
        "Absolutely fantastic resource! This guide helped me launch my first book successfully. The templates are professional and easy to use.",
      date: "2024-01-10",
      verified: true,
    },
    {
      id: "2",
      userName: "Mike R.",
      rating: 4,
      comment:
        "Great content and very detailed. Would have liked more examples, but overall excellent value for money.",
      date: "2024-01-08",
      verified: true,
    },
    {
      id: "3",
      userName: "Emma L.",
      rating: 5,
      comment:
        "This is exactly what I needed to organize my content creation. The planner is beautifully designed and very practical.",
      date: "2024-01-05",
      verified: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={cartItems.length}
      />

      <div className="container mx-auto px-4 py-8">
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
              />
            </div>
            {productItemData.images.length > 1 && (
              <div className="flex gap-2">
                {productItemData?.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`relative w-20 h-24 rounded-md overflow-hidden border-2 ${
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
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">
                {productItemData?.category} › {productItemData?.subcategory}
              </div>
              <h1 className="text-3xl font-bold mb-4">
                {productItemData?.title}
              </h1>

              {/* Author Info */}
              <Link
                href={`/author/${productItemData?.User?.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
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
                    <div className="font-semibold text-purple-600">
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
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">
                  ${productItemData.price}
                </span>
                {productItemData.originalPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    ${productItemData.originalPrice}
                  </span>
                )}
                {productItemData.originalPrice && (
                  <Badge className="bg-red-500">
                    Save{" "}
                    {Math.round(
                      ((productItemData.originalPrice - productItemData.price) /
                        productItemData.originalPrice) *
                        100
                    )}
                    %
                  </Badge>
                )}
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
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button onClick={handleAddToCart} size="lg" className="w-full">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Add to Cart
              </Button>
              <div className="flex gap-2">
                <form action={formAction}>
                  <input
                    type="hidden"
                    name="productId"
                    value={productItemData?.id}
                  />
                  <Button
                    //onClick={toggleWishlist}
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    //disabled={wishlistLoading}
                    type="submit"
                  >
                    <Heart
                      className={`h-4 w-4 mr-2 ${state?.inWishlist ? "fill-current text-red-500" : ""}`}
                    />
                  </Button>
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
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="contents">What&apos;s Included</TabsTrigger>
            <TabsTrigger value="reviews">
              Reviews ({productItemData?.reviewCount})
            </TabsTrigger>
            <TabsTrigger value="author">About Author</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="prose max-w-none">
                  <p className="text-lg mb-4">{productItemData?.description}</p>
                  <h3 className="text-xl font-semibold mb-3">
                    What You&apos;ll Learn
                  </h3>
                  <ul className="space-y-2">
                    <li>
                      • Complete step-by-step process from start to finish
                    </li>
                    <li>• Professional templates and tools used by experts</li>
                    <li>• Real-world examples and case studies</li>
                    <li>
                      • Actionable strategies you can implement immediately
                    </li>
                    <li>• Bonus resources and exclusive content</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contents" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">Main Guide (PDF)</div>
                      <div className="text-sm text-muted-foreground">
                        200 pages of comprehensive content
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Bonus Templates</div>
                      <div className="text-sm text-muted-foreground">
                        15 ready-to-use templates
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="font-medium">Checklists & Worksheets</div>
                      <div className="text-sm text-muted-foreground">
                        Step-by-step action items
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Award className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="font-medium">Bonus Resources</div>
                      <div className="text-sm text-muted-foreground">
                        Exclusive tools and resources
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <div className="space-y-6">
              {reviews?.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar color="bg-red-500">
                        <AvatarFallback>
                          {review.userName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{review.userName}</span>
                          {review.verified && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < review.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {review.date}
                          </span>
                        </div>
                        <p className="text-sm">{review.comment}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="author" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar
                    className="h-16 w-16"
                    color={productItemData?.User?.color}
                    imageUrl={productItemData?.User?.image}
                    initials={productItemData?.User?.name.charAt(0)}
                  >
                    <AvatarFallback className="text-lg">
                      {productItemData?.User?.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      {productItemData?.User?.name}
                    </h3>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{productItemData?.authorRating} rating</span>
                      </div>
                      <div>{productItemData?.authorSales} sales</div>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      Experienced content creator and bestselling author with
                      over 10 years in the publishing industry. Specializes in
                      helping new authors navigate the complex world of
                      self-publishing and book marketing.
                    </p>
                    <Link
                      href={`/author/${productItemData?.User?.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Button variant="outline">View Profile</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
