"use client";
import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

const CartContext = createContext();

const CartContextProvider = ({
  children,
  ignoreUrlFilters = false,
  pageSize = 10,
  autoLoadAll = false,
}) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // URL-synchronized state using nuqs
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [category, setCategory] = useQueryState("category", {
    defaultValue: "",
  });
  const [sort, setSort] = useQueryState("sort", { defaultValue: "created_at" });
  const [order, setOrder] = useQueryState("order", { defaultValue: "desc" });

  const effectiveSearch = ignoreUrlFilters ? "" : search;
  const effectiveCategory = ignoreUrlFilters ? "" : category;
  const effectiveSort = ignoreUrlFilters ? "created_at" : sort;
  const effectiveOrder = ignoreUrlFilters ? "desc" : order;
  const effectivePageSize = Number.isFinite(Number(pageSize))
    ? Math.min(Math.max(Number(pageSize), 1), 50)
    : 10;

  // Fetch cart data with infinite query for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      "cart",
      session?.user?.pen_name,
      effectiveSearch,
      effectiveCategory,
      effectiveSort,
      effectiveOrder,
      effectivePageSize,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      if (!session?.user?.pen_name) {
        throw new Error("User not authenticated");
      }

      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: String(effectivePageSize),
        ...(effectiveSearch && { search: effectiveSearch }),
        ...(effectiveCategory && { category: effectiveCategory }),
        sort: effectiveSort,
        order: effectiveOrder,
      });

      const response = await fetch(
        `/api/marketplace/products/carts/${session.user.pen_name}?${params}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch cart data");
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

  useEffect(() => {
    if (!autoLoadAll) return;
    if (!hasNextPage) return;
    if (isLoading || isFetchingNextPage) return;
    fetchNextPage();
  }, [autoLoadAll, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, data]);

  // Update cart item quantity mutation with optimistic updates
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }) => {
      const response = await fetch(
        `/api/marketplace/products/item/${itemId}/carts/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "update_quantity",
            quantity,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update cart item");
      }

      return response.json();
    },
    onMutate: async ({ itemId, quantity }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["cart", session?.user?.pen_name],
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData([
        "cart",
        session?.user?.pen_name,
        effectiveSearch,
        effectiveCategory,
        effectiveSort,
        effectiveOrder,
        effectivePageSize,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(
        [
          "cart",
          session?.user?.pen_name,
          effectiveSearch,
          effectiveCategory,
          effectiveSort,
          effectiveOrder,
          effectivePageSize,
        ],
        (old) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                items: page.data.items.map((item) => {
                  if (item.id !== itemId) return item;
                  // Use the effective price from product (API returns effective price)
                  const unitPrice = item.product?.price || 0;
                  return {
                    ...item,
                    quantity,
                    price: unitPrice * quantity,
                  };
                }),
              },
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          [
            "cart",
            session?.user?.pen_name,
            effectiveSearch,
            effectiveCategory,
            effectiveSort,
            effectiveOrder,
            effectivePageSize,
          ],
          context.previousData
        );
      }
      toast.error("Failed to update cart item");
    },
    onSuccess: () => {
      toast.success("Cart updated successfully");
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ["cart", session?.user?.pen_name],
      });
    },
  });

  // Remove cart item mutation with optimistic updates
  const removeItemMutation = useMutation({
    mutationFn: async (itemId) => {
      const response = await fetch(
        `/api/marketplace/products/item/${itemId}/carts/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "remove_item",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove cart item");
      }

      return response.json();
    },
    onMutate: async (itemId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["cart", session?.user?.pen_name],
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData([
        "cart",
        session?.user?.pen_name,
        effectiveSearch,
        effectiveCategory,
        effectiveSort,
        effectiveOrder,
        effectivePageSize,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(
        [
          "cart",
          session?.user?.pen_name,
          effectiveSearch,
          effectiveCategory,
          effectiveSort,
          effectiveOrder,
          effectivePageSize,
        ],
        (old) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                items: page.data.items.filter((item) => item.id !== itemId),
              },
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          [
            "cart",
            session?.user?.pen_name,
            effectiveSearch,
            effectiveCategory,
            effectiveSort,
            effectiveOrder,
            effectivePageSize,
          ],
          context.previousData
        );
      }
      toast.error("Failed to remove cart item");
    },
    onSuccess: () => {
      toast.success("Item removed from cart");
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ["cart", session?.user?.pen_name],
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

  const applyCouponMutation = useMutation({
    mutationFn: async ({ code }) => {
      if (!session?.user?.pen_name) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `/api/marketplace/products/carts/${session.user.pen_name}/coupon`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to apply coupon");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Coupon applied");
      queryClient.invalidateQueries({
        queryKey: ["cart", session?.user?.pen_name],
      });
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to apply coupon");
    },
  });

  const removeCouponMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.pen_name) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `/api/marketplace/products/carts/${session.user.pen_name}/coupon`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to remove coupon");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Coupon removed");
      queryClient.invalidateQueries({
        queryKey: ["cart", session?.user?.pen_name],
      });
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to remove coupon");
    },
  });

  // Flatten paginated data with proper error handling
  const cartItems =
    data?.pages?.flatMap((page) => page?.data?.items || []) || [];
  const cartSummary = data?.pages?.[0]?.data?.cart || null;
  const pagination =
    data?.pages?.[data.pages.length - 1]?.data?.pagination || null;
  console.log("item cart", cartItems);

  const lastCouponNoticeRef = useRef(null);
  useEffect(() => {
    const notice = cartSummary?.coupon_notice;
    if (!notice?.reason) return;
    const key = `${notice.reason}:${notice.code || ""}`;
    if (lastCouponNoticeRef.current === key) return;
    lastCouponNoticeRef.current = key;

    const msg =
      notice.reason === "expired"
        ? "Your coupon expired and was removed"
        : notice.reason === "inactive"
          ? "Your coupon is not active and was removed"
          : notice.reason === "not_started"
            ? "Your coupon is not active yet and was removed"
            : notice.reason === "min_order_amount"
              ? "Your cart no longer qualifies for this coupon and it was removed"
              : notice.reason === "not_found"
                ? "Your coupon is no longer valid and was removed"
                : "Your coupon was removed";

    toast.error(msg);
  }, [
    cartSummary?.coupon_notice?.reason,
    cartSummary?.coupon_notice?.code,
    cartSummary?.coupon_notice,
  ]);
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
    applyCoupon: (code, options) =>
      applyCouponMutation.mutate({ code }, options),
    removeCoupon: (options) => removeCouponMutation.mutate(undefined, options),
    loadMore,
    refetch,

    // Mutation states
    isUpdating: updateQuantityMutation.isPending,
    isRemoving: removeItemMutation.isPending,
    isApplyingCoupon: applyCouponMutation.isPending,
    isRemovingCoupon: removeCouponMutation.isPending,

    // Filters
    search: effectiveSearch,
    setSearch: ignoreUrlFilters ? () => {} : setSearch,
    category: effectiveCategory,
    setCategory: ignoreUrlFilters ? () => {} : setCategory,
    sort: effectiveSort,
    setSort: ignoreUrlFilters ? () => {} : setSort,
    order: effectiveOrder,
    setOrder: ignoreUrlFilters ? () => {} : setOrder,
  };

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
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
