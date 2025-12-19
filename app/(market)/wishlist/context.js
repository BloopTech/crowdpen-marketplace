"use client";
import React, { createContext, useContext } from "react";
import { useQueryState } from "nuqs";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

const WishlistContext = createContext();

const WishlistContextProvider = ({ children }) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // URL-synchronized state using nuqs
  const [search, setSearch] = useQueryState('search', { defaultValue: '' });
  const [category, setCategory] = useQueryState('category', { defaultValue: '' });
  const [sortBy, setSortBy] = useQueryState('sort', { defaultValue: 'created_at' });
  const [sortOrder, setSortOrder] = useQueryState('order', { defaultValue: 'desc' });
  const [minPrice, setMinPrice] = useQueryState('minPrice', { 
    defaultValue: 0,
    parse: (value) => parseFloat(value) || 0,
    serialize: (value) => value.toString()
  });
  const [maxPrice, setMaxPrice] = useQueryState('maxPrice', { 
    defaultValue: 10000,
    parse: (value) => parseFloat(value) || 10000,
    serialize: (value) => value.toString()
  });

  // Fetch wishlist data with infinite query for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['wishlist', session?.user?.pen_name, search, category, sortBy, sortOrder, minPrice, maxPrice],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '20',
        ...(search && { search }),
        ...(category && { category }),
        sort: sortBy,
        order: sortOrder,
        minPrice: minPrice.toString(),
        maxPrice: maxPrice.toString()
      });

      const response = await fetch(`/api/marketplace/products/wishlist/${session?.user?.pen_name}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch wishlist: ${response.statusText}`);
      }
      
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage.data;
      return pagination.hasNextPage ? pagination.currentPage + 1 : undefined;
    },
    enabled: !!session?.user?.pen_name,
    refetchOnWindowFocus: false
  });

  // Add all products to cart mutation
  const addAllToCartMutation = useMutation({
    mutationFn: async (productIds) => {
      const response = await fetch('/api/marketplace/products/carts/addProducts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add products to cart');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate cart queries to refresh cart data
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    }
  });

  // Clear all wishlist mutation
  const clearWishlistMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/marketplace/products/wishlist/clear', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear wishlist');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate wishlist queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    }
  });

  // Get all products from all pages
  const allProducts = data?.pages?.flatMap(page => page.data.products) || [];
  const totalItems = data?.pages?.[0]?.data?.pagination?.totalItems || 0;
  const user = data?.pages?.[0]?.data?.user;

  // Filter functions
  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setMinPrice(0);
    setMaxPrice(10000);
  };

  const updateFilters = (filters) => {
    if (filters.search !== undefined) setSearch(filters.search);
    if (filters.category !== undefined) setCategory(filters.category);
    if (filters.sortBy !== undefined) setSortBy(filters.sortBy);
    if (filters.sortOrder !== undefined) setSortOrder(filters.sortOrder);
    if (filters.minPrice !== undefined) setMinPrice(filters.minPrice);
    if (filters.maxPrice !== undefined) setMaxPrice(filters.maxPrice);
  };

  const contextValue = {
    // Data
    products: allProducts,
    totalItems,
    user,
    
    // Loading states
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    
    // Pagination
    fetchNextPage,
    refetch,
    
    // Filters (URL-synchronized)
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
    updateFilters,
    
    // Actions
    addAllToCart: addAllToCartMutation.mutate,
    clearWishlist: clearWishlistMutation.mutate,
    
    // Action states
    isAddingToCart: addAllToCartMutation.isPending,
    isClearingWishlist: clearWishlistMutation.isPending,
    
    // Action errors
    addToCartError: addAllToCartMutation.error,
    clearWishlistError: clearWishlistMutation.error
  };

  return (
    <WishlistContext.Provider value={contextValue}>
      {children}
    </WishlistContext.Provider>
  );
};

const useWishlistContext = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlistContext must be used within a WishlistContextProvider');
  }
  return context;
};

export { WishlistContextProvider, useWishlistContext };
