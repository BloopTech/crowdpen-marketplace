"use client";

import React, {
  useEffect,
  useCallback,
  useActionState,
  useState,
  useOptimistic,
} from "react";
import Image from "next/image";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { useAuthorProfile } from "./context";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Heart,
  ShoppingCart,
  Star,
  MapPin,
  Calendar,
  Users,
  TrendingUp,
  Award,
  Search,
  Filter,
  Grid,
  List,
  ExternalLink,
  Verified,
  Twitter,
  Linkedin,
  Instagram,
  Globe,
  BookOpen,
  DollarSign,
  MessageSquare,
  Eye,
  Loader2,
  CheckCircle,
  Clock,
  LoaderCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { addProductToCart, addProductWishlist } from "./action";
import { toast } from "sonner";
import { useHome } from "../../../context";
import millify from "millify";
import MyProductCard from "./product-card";
import MarketplaceHeader from "../../../components/marketplace-header";
import Link from "next/link";
import { Skeleton } from "../../../components/ui/skeleton";

export default function AuthorProfileContent({ author }) {
  const {
    // Search and filter state
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,

    // Products state
    products,
    productsHasMore,
    productsLoading,
    loadMoreProducts,
    productsQuery, // For error handling and manual refetching
    totalProducts,

    // Reviews state
    reviews,
    reviewsHasMore,
    reviewsLoading,
    reviewsRating,
    setReviewsRating,
    reviewsSortBy,
    setReviewsSortBy,
    loadMoreReviews,
    reviewsQuery, // For error handling and manual refetching

    // Author stats (client-fetched)
    authorStats,
    authorStatsLoading,
    authorStatsError,
    authorCategories,
  } = useAuthorProfile();
  const [optimisticCart, addOptimisticCart] = useOptimistic(
    products,
    (state, newCart) => [...state, { cartItem: newCart }]
  );
  const [optimisticWishlist, addOptimisticWishlist] = useOptimistic(
    products,
    (state, newWishlist) => [...state, { wishlistItem: newWishlist }]
  );

  // Initialize data on mount - using useCallback to fix lint warnings
  const initializeData = useCallback(() => {
    if (author?.pen_name) {
      loadMoreProducts(author.pen_name, true);
      loadMoreReviews(author.pen_name, true);
    }
  }, [author, loadMoreProducts, loadMoreReviews]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // Reload products when filters change
  const reloadProducts = useCallback(() => {
    if (author?.pen_name) {
      loadMoreProducts(author.pen_name, true);
    }
  }, [author, loadMoreProducts]);

  useEffect(() => {
    reloadProducts();
  }, [searchQuery, selectedCategory, sortBy, reloadProducts]);

  // Reload reviews when filters change
  const reloadReviews = useCallback(() => {
    if (author?.pen_name) {
      loadMoreReviews(author.pen_name, true);
    }
  }, [author, loadMoreReviews]);

  useEffect(() => {
    reloadReviews();
  }, [reviewsRating, reviewsSortBy, reloadReviews]);

  // Infinite scroll hooks
  const [productsScrollRef] = useInfiniteScroll({
    loading: productsLoading,
    hasNextPage: productsHasMore,
    onLoadMore: () => loadMoreProducts(author?.pen_name),
    disabled: !author?.pen_name,
  });

  const [reviewsScrollRef] = useInfiniteScroll({
    loading: reviewsLoading,
    hasNextPage: reviewsHasMore,
    onLoadMore: () => loadMoreReviews(author?.pen_name),
    disabled: !author?.pen_name,
  });

  if (!author) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading author profile...</p>
        </div>
      </div>
    );
  }
  const categories = Array.isArray(authorCategories)
    ? Array.from(new Set(authorCategories.filter(Boolean)))
    : [];
  const categoriesLoading = authorStatsLoading && categories.length === 0;

  const totalProductsStat =
    typeof authorStats?.totalProducts === "number"
      ? authorStats.totalProducts
      : null;
  const totalReviewsStat =
    typeof authorStats?.totalReviews === "number"
      ? authorStats.totalReviews
      : null;
  const averageRatingStat =
    typeof authorStats?.averageRating === "number"
      ? authorStats.averageRating
      : null;

  const statsFetchPending = authorStatsLoading && !authorStats;
  const formatCount = (value) =>
    typeof value === "number" ? millify(value) : "0";
  const formatRating = (value) =>
    typeof value === "number" ? value.toFixed(1) : "0.0";

  const totalProductsLabel = statsFetchPending
    ? "…"
    : formatCount(totalProductsStat ?? 0);
  const totalReviewsLabel = statsFetchPending
    ? "…"
    : formatCount(totalReviewsStat ?? 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <MarketplaceHeader hideFilters={true} />
      
      {/* Hero Section */}
      <div className="relative">
        <div
          className="relative h-80 overflow-hidden"
          style={{ backgroundColor: author?.color }}
        >
          {author.cover_image ? (
            <Image
              src={author.cover_image}
              alt="Cover"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : null}
        </div>
      </div>

      {/* Profile Card - Extended below hero */}
      <div className="relative -mt-20 z-1">
        <div className="max-w-4xl mx-auto px-6">
          <Card className="bg-card/85 backdrop-blur-sm shadow-2xl rounded-2xl">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="relative">
                  <Avatar className="w-32 h-32 ring-4 ring-border shadow-xl">
                    <AvatarImage
                      src={author.image || "/default-avatar.png"}
                      alt={author.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {author.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {author.verification_badge && (
                    <div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-2">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                    <h1 className="text-3xl font-bold text-foreground">
                      {author.name}
                    </h1>
                    {author.verification_badge && (
                      <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
                        <Verified className="w-4 h-4 mr-1" />
                        Verified Creator
                      </Badge>
                    )}
                  </div>

                  <p className="text-muted-foreground mb-4 max-w-2xl">{author?.bio}</p>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground mb-4">
                    {author?.residence && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {author.residence}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Joined{" "}
                      {new Date(author.joinDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Last active{" "}
                      {new Date(author.lastLoginDate).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        }
                      )}
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    {author.twitter_url && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={author.twitter_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Twitter className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                    {author.linkedin_url && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={author.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Linkedin className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                    {author.instagram_url && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={author.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Instagram className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                    {author.website_url && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={author.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Section */}
      <div className="pt-28 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          {authorStatsError ? (
            <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load creator statistics. Please refresh the page to try
              again.
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-4 mb-12">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-500/10 dark:to-blue-500/5 dark:border-blue-500/20">
              <CardContent className="p-6 text-center">
                <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                {authorStatsLoading ? (
                  <Skeleton className="h-8 w-24 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-blue-900">
                    {formatCount(totalProductsStat ?? 0)}
                  </div>
                )}
                <div className="text-sm text-blue-700">Products</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 dark:from-amber-500/10 dark:to-amber-500/5 dark:border-amber-500/20">
              <CardContent className="p-6 text-center">
                <Star className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                {authorStatsLoading ? (
                  <Skeleton className="h-8 w-20 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-yellow-900">
                    {formatRating(averageRatingStat ?? 0)}
                  </div>
                )}
                <div className="text-sm text-yellow-700">Avg Rating</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-500/10 dark:to-purple-500/5 dark:border-purple-500/20">
              <CardContent className="p-6 text-center">
                <MessageSquare className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                {authorStatsLoading ? (
                  <Skeleton className="h-8 w-24 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-purple-900">
                    {formatCount(totalReviewsStat ?? 0)}
                  </div>
                )}
                <div className="text-sm text-purple-700">Reviews</div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Grid className="w-4 h-4" />
                Products ({totalProductsLabel})
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Reviews ({totalReviewsLabel})
              </TabsTrigger>
            </TabsList>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-6">
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {categoriesLoading ? (
                  <Skeleton className="h-10 w-full md:w-48" />
                ) : (
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price-low">
                      Price: Low to High
                    </SelectItem>
                    <SelectItem value="price-high">
                      Price: High to Low
                    </SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="sales">Most Popular</SelectItem>
                    <SelectItem value="bestsellers">Bestsellers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products?.length
                  ? products?.map((product) => {
                      return (
                        <MyProductCard key={product.id} product={product} />
                      );
                    })
                  : null}
              </div>

              {/* Products Loading/End Indicator */}
              <div ref={productsScrollRef} className="flex justify-center py-8">
                {productsLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading more products...
                  </div>
                )}
                {!productsHasMore && products.length > 0 && (
                  <p className="text-muted-foreground">No more products to load</p>
                )}
                {!productsLoading && products.length === 0 && (
                  <p className="text-muted-foreground">No products found</p>
                )}
              </div>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="space-y-6">
              {/* Review Filters */}
              <div className="flex flex-col md:flex-row gap-4 bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border">
                <Select value={reviewsRating} onValueChange={setReviewsRating}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={reviewsSortBy} onValueChange={setReviewsSortBy}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="rating-high">Highest Rating</SelectItem>
                    <SelectItem value="rating-low">Lowest Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                {reviews?.length
                  ? reviews?.map((review) => {
                      return (
                        <Card
                          key={review.id}
                          className="shadow-sm"
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <Avatar className="w-12 h-12">
                                <AvatarImage
                                  src={
                                    review.user?.image || "/default-avatar.png"
                                  }
                                  alt={review.user?.name || "Anonymous"}
                                />
                                <AvatarFallback>
                                  {review.user?.name?.charAt(0) || "A"}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold text-foreground">
                                      {review.user?.name || "Anonymous User"}
                                    </h4>
                                    <div className="flex items-center gap-1 mt-1">
                                      {[...Array(5)].map((_, i) => (
                                        <Star
                                          key={i}
                                          className={`w-4 h-4 ${
                                            i < review.rating
                                              ? "fill-yellow-400 text-yellow-400"
                                              : "text-slate-300 dark:text-gray-600"
                                          }`}
                                        />
                                      ))}
                                      <span className="text-sm text-muted-foreground ml-2">
                                        {new Date(
                                          review.createdAt
                                        ).toLocaleDateString("en-US", {
                                          timeZone: "UTC",
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-foreground mb-3">
                                  {review.comment}
                                </p>

                                {review.product && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>Product:</span>
                                    <span className="font-medium text-foreground">
                                      {review.product.title}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  : null}
              </div>

              {/* Reviews Loading/End Indicator */}
              <div ref={reviewsScrollRef} className="flex justify-center py-8">
                {reviewsLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading more reviews...
                  </div>
                )}
                {!reviewsHasMore && reviews.length > 0 && (
                  <p className="text-muted-foreground">No more reviews to load</p>
                )}
                {!reviewsLoading && reviews.length === 0 && (
                  <p className="text-muted-foreground">No reviews found</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
