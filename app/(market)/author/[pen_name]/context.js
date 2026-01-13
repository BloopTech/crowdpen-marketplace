"use client";

import React, { createContext, useContext } from "react";
import { useQueryState, parseAsString } from "nuqs";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

const AuthorProfileContext = createContext();

function AuthorProfileContextProvider({ children }) {
  const params = useParams();
  const authorPenName = params.pen_name;

  // URL-synchronized state using nuqs
  const [searchQuery, setSearchQuery] = useQueryState("search", parseAsString.withDefault(""));
  const [selectedCategory, setSelectedCategory] = useQueryState("category", parseAsString.withDefault("all"));
  const [sortBy, setSortBy] = useQueryState("sort", parseAsString.withDefault("newest"));
  const [reviewsRating, setReviewsRating] = useQueryState("rating", parseAsString.withDefault(""));
  const [reviewsSortBy, setReviewsSortBy] = useQueryState("reviewSort", parseAsString.withDefault("newest"));

  // Fetch products with infinite scrolling using TanStack Query
  const fetchProducts = async ({ pageParam = 1 }) => {
    const params = new URLSearchParams({
      page: pageParam.toString(),
      limit: '20',
      ...(searchQuery && { search: searchQuery }),
      ...(selectedCategory !== 'all' && { category: selectedCategory }),
      sortBy
    });
    
    const response = await fetch(`/api/marketplace/author/${authorPenName}/products?${params}`);
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to fetch products');
    }
    
    return {
      products: data.products,
      nextPage: data.pagination.hasMore ? pageParam + 1 : undefined,
      hasMore: data.pagination.hasMore,
      total_count: data.pagination.total
    };
  };

  const productsQuery = useInfiniteQuery({
    queryKey: ['author-products', authorPenName, searchQuery, selectedCategory, sortBy],
    queryFn: fetchProducts,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!authorPenName,
    // staleTime: 5 * 60 * 1000, // 5 minutes
    // cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const products = productsQuery.data?.pages.flatMap(page => page.products) || [];
  const productsLoading = productsQuery.isLoading || productsQuery.isFetchingNextPage;
  const productsHasMore = productsQuery.hasNextPage;
  const totalProducts = productsQuery?.data?.pages?.[0]?.total_count;
  
  const loadMoreProducts = () => {
    if (productsHasMore && !productsLoading) {
      productsQuery.fetchNextPage();
    }
  };

  // Fetch reviews with infinite scrolling using TanStack Query
  const fetchReviews = async ({ pageParam = 1 }) => {
    const params = new URLSearchParams({
      page: pageParam.toString(),
      limit: '10',
      ...(reviewsRating && { rating: reviewsRating }),
      sortBy: reviewsSortBy
    });
    
    const response = await fetch(`/api/marketplace/author/${authorPenName}/reviews?${params}`);
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to fetch reviews');
    }
    
    return {
      reviews: data.reviews,
      nextPage: data.pagination.hasMore ? pageParam + 1 : undefined,
      hasMore: data.pagination.hasMore
    };
  };

  const reviewsQuery = useInfiniteQuery({
    queryKey: ['author-reviews', authorPenName, reviewsRating, reviewsSortBy],
    queryFn: fetchReviews,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!authorPenName,
    // staleTime: 5 * 60 * 1000, // 5 minutes
    // cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const reviews = reviewsQuery.data?.pages.flatMap(page => page.reviews) || [];
  const reviewsLoading = reviewsQuery.isLoading || reviewsQuery.isFetchingNextPage;
  const reviewsHasMore = reviewsQuery.hasNextPage;
  
  const loadMoreReviews = () => {
    if (reviewsHasMore && !reviewsLoading) {
      reviewsQuery.fetchNextPage();
    }
  };

  // Fetch heavy statistics client-side to avoid blocking server render
  const fetchAuthorStats = async () => {
    const response = await fetch(`/api/marketplace/author/${authorPenName}`);
    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      throw new Error(
        (data && data.message) || "Failed to fetch author stats"
      );
    }

    if (data.status !== "success" || !data.author?.stats) {
      throw new Error(data.message || "Failed to fetch author stats");
    }

    return data.author.stats;
  };

  const authorStatsQuery = useQuery({
    queryKey: ["author-stats", authorPenName],
    queryFn: fetchAuthorStats,
    enabled: !!authorPenName,
    staleTime: 5 * 60 * 1000,
  });

  const authorStats = authorStatsQuery.data || null;
  const authorStatsLoading = authorStatsQuery.isLoading;
  const authorStatsError = authorStatsQuery.error;
  const authorCategories = Array.isArray(authorStats?.categories)
    ? authorStats.categories
    : [];

  const value = {
    // Search and filter state (URL-synchronized)
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    reviewsRating,
    setReviewsRating,
    reviewsSortBy,
    setReviewsSortBy,
    
    // Products state (TanStack Query)
    products,
    productsHasMore,
    productsLoading,
    loadMoreProducts,
    productsQuery,
    totalProducts,
    
    // Reviews state (TanStack Query)
    reviews,
    reviewsHasMore,
    reviewsLoading,
    loadMoreReviews,
    reviewsQuery,
    
    // Author info
    authorPenName,
    authorStats,
    authorStatsLoading,
    authorCategories,
    authorStatsError,
  };

  return (
    <AuthorProfileContext.Provider value={value}>
      {children}
    </AuthorProfileContext.Provider>
  );
}

function useAuthorProfile() {
  const context = useContext(AuthorProfileContext);
  if (context === undefined) {
    throw new Error("useAuthorProfile must be used within an AuthorProfileContextProvider");
  }
  return context;
}


export { AuthorProfileContextProvider, useAuthorProfile };