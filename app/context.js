"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useOptimistic,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useSession } from "next-auth/react";

// API functions for data fetching with proper error handling
const fetchProducts = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();

    // Add all filters to query params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, value);
      }
    });

    const response = await fetch(
      `/api/marketplace/products?${queryParams.toString()}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch products");
    }

    return response.json();
  } catch (error) {
    console.error("Products fetch error:", error);
    throw error;
  }
};

const fetchCategories = async () => {
  try {
    const response = await fetch("/api/marketplace/categories");

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch categories");
    }

    return response.json();
  } catch (error) {
    console.error("Categories fetch error:", error);
    throw error;
  }
};

const fetchTags = async () => {
  try {
    const response = await fetch("/api/marketplace/tags");

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch tags");
    }

    return response.json();
  } catch (error) {
    console.error("Tags fetch error:", error);
    throw error;
  }
};

// Context setup
const HomeContext = createContext(null);

const HomeProvider = ({ children }) => {
  const [loginDialog, setLoginDialog] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState("login");
  const { data: session } = useSession();

  // Use nuqs for URL state management directly
  const [category, setCategory] = useQueryState("category", {
    defaultValue: "All",
  });
  const [subcategory, setSubcategory] = useQueryState("subcategory", {
    defaultValue: "",
  });
  const [tag, setTag] = useQueryState("tag", { defaultValue: "" });
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [minPrice, setMinPrice] = useQueryState("minPrice", {
    defaultValue: 0,
    parse: Number,
  });
  const [maxPrice, setMaxPrice] = useQueryState("maxPrice", {
    defaultValue: 1000,
    parse: Number,
  });
  const [rating, setRating] = useQueryState("rating", {
    defaultValue: 0,
    parse: Number,
  });
  const [sort, setSort] = useQueryState("sort", { defaultValue: "all" });
  const [fileType, setFileType] = useQueryState("fileType", {
    defaultValue: "",
  });
  const [deliveryTime, setDeliveryTime] = useQueryState("deliveryTime", {
    defaultValue: "",
  });
  const [contentLength, setContentLength] = useQueryState("contentLength", {
    defaultValue: "",
  });
  const [page, setPage] = useQueryState("page", {
    defaultValue: 1,
    parse: Number,
  });
  const [limit, setLimit] = useQueryState("limit", {
    defaultValue: 20,
    parse: Number,
  });

  // Derive the filters object from URL state
  const filters = {
    category,
    subcategory,
    tag,
    minPrice,
    maxPrice,
    rating,
    sort,
    search,
    fileType,
    deliveryTime,
    contentLength,
    page,
    limit,
  };

  // Query client
  const queryClient = useQueryClient();

  // Products query hook with the requested format
  const {
    isLoading: isProductsLoading,
    isFetching: isProductsFetching,
    error: productsError,
    data: productsData,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      return fetchProducts(filters);
    },
    keepPreviousData: true,
  });
  console.log("prod data", productsData);
  // Categories query hook with the requested format
  const {
    isLoading: isCategoriesLoading,
    error: categoriesError,
    data: categoriesData,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      return fetchCategories();
    },
  });

  // Tags query hook with the requested format
  const {
    isLoading: isTagsLoading,
    error: tagsError,
    data: tagsData,
    refetch: refetchTags,
  } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      return fetchTags();
    },
  });

  const {
    isLoading: isWishlistCountLoading,
    error: wishlistCountError,
    data: wishlistCountData,
    refetch: refetchWishlistCount,
  } = useQuery({
    queryKey: ["wishlistCount", session?.user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/products/wishlist`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const {
    isLoading: isCartCountLoading,
    error: cartCountError,
    data: cartCountData,
    refetch: refetchCartCount,
  } = useQuery({
    queryKey: ["cartCount", session?.user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/products/carts`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  // Optimistic state management for cart and wishlist
  const [optimisticProducts, addOptimisticUpdate] = useOptimistic(
    productsData?.products || [],
    (state, update) => {
      const { type, productId, action } = update;
      return state.map((product) => {
        if (product.id === productId) {
          if (type === "wishlist") {
            return {
              ...product,
              wishlist:
                action === "add"
                  ? [
                      ...(product.wishlist || []),
                      {
                        user_id: session?.user?.id,
                        marketplace_product_id: productId,
                      },
                    ]
                  : (product.wishlist || []).filter(
                      (w) => w.user_id !== session?.user?.id
                    ),
            };
          } else if (type === "cart") {
            return {
              ...product,
              Cart:
                action === "add"
                  ? [
                      ...(product.Cart || []),
                      {
                        user_id: session?.user?.id,
                        cartItems: [{ marketplace_product_id: productId }],
                      },
                    ]
                  : (product.Cart || []).filter(
                      (c) => c.user_id !== session?.user?.id
                    ),
            };
          }
        }
        return product;
      });
    }
  );

  // Optimistic update functions
  const addOptimisticWishlist = (productId) => {
    addOptimisticUpdate({ type: "wishlist", productId, action: "add" });
  };

  const removeOptimisticWishlist = (productId) => {
    addOptimisticUpdate({ type: "wishlist", productId, action: "remove" });
  };

  const addOptimisticCart = (productId) => {
    addOptimisticUpdate({ type: "cart", productId, action: "add" });
  };

  const removeOptimisticCart = (productId) => {
    addOptimisticUpdate({ type: "cart", productId, action: "remove" });
  };



  // Auth related functions
  const openLoginDialog = (mode = "login") => {
    setAuthDialogMode(mode);
    setLoginDialog(true);
  };

  const closeLoginDialog = () => {
    setLoginDialog(false);
  };

  // Filter update functions - now using nuqs setters
  const updateFilters = (newFilters) => {
    if (newFilters.category !== undefined) setCategory(newFilters.category);
    if (newFilters.subcategory !== undefined)
      setSubcategory(newFilters.subcategory);
    if (newFilters.tag !== undefined) setTag(newFilters.tag);
    if (newFilters.search !== undefined) setSearch(newFilters.search);
    if (newFilters.minPrice !== undefined) setMinPrice(newFilters.minPrice);
    if (newFilters.maxPrice !== undefined) setMaxPrice(newFilters.maxPrice);
    if (newFilters.rating !== undefined) setRating(newFilters.rating);
    if (newFilters.sort !== undefined) setSort(newFilters.sort);
    if (newFilters.fileType !== undefined) setFileType(newFilters.fileType);
    if (newFilters.deliveryTime !== undefined)
      setDeliveryTime(newFilters.deliveryTime);
    if (newFilters.contentLength !== undefined)
      setContentLength(newFilters.contentLength);
    if (newFilters.limit !== undefined) setLimit(newFilters.limit);

    // Reset page to 1 when changing other filters unless page is explicitly set
    if (newFilters.page !== undefined) {
      setPage(newFilters.page);
    } else if (Object.keys(newFilters).length > 0) {
      setPage(1);
    }
  };

  const clearFilters = () => {
    setCategory("All");
    setSubcategory("");
    setTag("");
    setSearch("");
    setMinPrice(0);
    setMaxPrice(1000);
    setRating(0);
    setSort("all");
    setFileType("");
    setDeliveryTime("");
    setContentLength("");
    setPage(1);
    // We keep limit as is
  };

  // For pagination
  const nextPage = () => {
    if (productsData && page < productsData.totalPages) {
      setPage(page + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  return (
    <HomeContext.Provider
      value={{
        // Auth
        loginDialog,
        openLoginDialog,
        closeLoginDialog,
        authDialogMode,
        setAuthDialogMode,

        // Data
        products: optimisticProducts,
        totalProducts: productsData?.total || 0,
        isProductsLoading,
        isProductsFetching,
        productsError,
        refetchProducts,

        categories: categoriesData || [],
        isCategoriesLoading,
        categoriesError,
        refetchCategories,

        tags: tagsData || [],
        isTagsLoading,
        tagsError,
        refetchTags,

        // Filters
        filters,
        updateFilters,
        clearFilters,

        // Pagination
        currentPage: page,
        totalPages: productsData?.totalPages || 1,
        nextPage,
        prevPage,

        // Wishlist Count
        wishlistCountData,
        isWishlistCountLoading,
        wishlistCountError,
        refetchWishlistCount,

        // Cart Count
        cartCountData,
        isCartCountLoading,
        cartCountError,
        refetchCartCount,

        // Optimistic updates
        addOptimisticWishlist,
        removeOptimisticWishlist,
        addOptimisticCart,
        removeOptimisticCart,
      }}
    >
      {children}
    </HomeContext.Provider>
  );
};

const useHome = () => {
  const context = useContext(HomeContext);
  if (!context) {
    throw new Error("useHome must be used within a HomeProvider");
  }
  return context;
};

export { HomeProvider, useHome };
