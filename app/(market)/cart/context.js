"use client";
import React, { createContext, useContext } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

const CartContext = createContext();

const CartContextProvider = ({ children }) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  
  // URL-synchronized state using nuqs
  const [search, setSearch] = useQueryState('search', { defaultValue: '' });
  const [category, setCategory] = useQueryState('category', { defaultValue: '' });
  const [sort, setSort] = useQueryState('sort', { defaultValue: 'created_at' });
  const [order, setOrder] = useQueryState('order', { defaultValue: 'desc' });
  
  // Fetch cart data with infinite query for pagination
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
    queryKey: ['cart', session?.user?.pen_name, search, category, sort, order],
    queryFn: async ({ pageParam = 1 }) => {
      if (!session?.user?.pen_name) {
        throw new Error('User not authenticated');
      }
      
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '10',
        ...(search && { search }),
        ...(category && { category }),
        sort,
        order
      });
      
      const response = await fetch(
        `/api/marketplace/products/carts/${session.user.pen_name}?${params}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch cart data');
      }
      
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.data.pagination.hasNextPage 
        ? lastPage.data.pagination.page + 1 
        : undefined;
    },
    enabled: !!session?.user?.pen_name,
    // staleTime: 5 * 60 * 1000, // 5 minutes
    // cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
  
  // Update cart item quantity mutation with optimistic updates
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }) => {
      const response = await fetch(
        `/api/marketplace/products/item/${itemId}/carts/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update_quantity',
            quantity
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update cart item');
      }
      
      return response.json();
    },
    onMutate: async ({ itemId, quantity }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: ['cart', session?.user?.pen_name] 
      });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData([
        'cart', 
        session?.user?.pen_name, 
        search, 
        category, 
        sort, 
        order
      ]);
      
      // Optimistically update the cache
      queryClient.setQueryData(
        ['cart', session?.user?.pen_name, search, category, sort, order],
        (old) => {
          if (!old) return old;
          
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              data: {
                ...page.data,
                items: page.data.items.map(item => {
                  if (item.id !== itemId) return item;
                  // Use the effective price from product (API returns effective price)
                  const unitPrice = item.product?.price || 0;
                  return { 
                    ...item, 
                    quantity,
                    price: unitPrice * quantity
                  };
                })
              }
            }))
          };
        }
      );
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          ['cart', session?.user?.pen_name, search, category, sort, order],
          context.previousData
        );
      }
      toast.error('Failed to update cart item');
    },
    onSuccess: () => {
      toast.success('Cart updated successfully');
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ 
        queryKey: ['cart', session?.user?.pen_name] 
      });
    },
  });
  
  // Remove cart item mutation with optimistic updates
  const removeItemMutation = useMutation({
    mutationFn: async (itemId) => {
      const response = await fetch(
        `/api/marketplace/products/item/${itemId}/carts/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'remove_item'
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove cart item');
      }
      
      return response.json();
    },
    onMutate: async (itemId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: ['cart', session?.user?.pen_name] 
      });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData([
        'cart', 
        session?.user?.pen_name, 
        search, 
        category, 
        sort, 
        order
      ]);
      
      // Optimistically update the cache
      queryClient.setQueryData(
        ['cart', session?.user?.pen_name, search, category, sort, order],
        (old) => {
          if (!old) return old;
          
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              data: {
                ...page.data,
                items: page.data.items.filter(item => item.id !== itemId)
              }
            }))
          };
        }
      );
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          ['cart', session?.user?.pen_name, search, category, sort, order],
          context.previousData
        );
      }
      toast.error('Failed to remove cart item');
    },
    onSuccess: () => {
      toast.success('Item removed from cart');
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ 
        queryKey: ['cart', session?.user?.pen_name] 
      });
    },
  });
  
  // Helper functions
  const updateQuantity = (itemId, quantity) => {
    updateQuantityMutation.mutate({ itemId, quantity });
  };
  
  const removeItem = (itemId) => {
    removeItemMutation.mutate(itemId);
  };
  
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };
  
  // Flatten paginated data with proper error handling
  const cartItems = data?.pages?.flatMap(page => page?.data?.items || []) || [];
  const cartSummary = data?.pages?.[0]?.data?.cart || null;
  const pagination = data?.pages?.[data.pages.length - 1]?.data?.pagination || null;
  console.log("item cart", cartItems)
  const contextValue = {
    // Data
    cartItems,
    cartSummary,
    pagination,
    
    // Loading states
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    
    // Actions
    updateQuantity,
    removeItem,
    loadMore,
    refetch,
    
    // Mutation states
    isUpdating: updateQuantityMutation.isPending,
    isRemoving: removeItemMutation.isPending,
    
    // Filters
    search,
    setSearch,
    category,
    setCategory,
    sort,
    setSort,
    order,
    setOrder,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export { CartContextProvider, useCart };
