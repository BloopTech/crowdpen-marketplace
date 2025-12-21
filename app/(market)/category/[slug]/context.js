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

const CategoryContext = createContext();

// API functions for data fetching with proper error handling
const fetchProducts = async (slug, params = {}) => {
  try {
    const queryParams = new URLSearchParams();

    // Add all filters to query params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, value);
      }
    });

    const response = await fetch(
      `/api/marketplace/categories/${slug}/products?${queryParams.toString()}`
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

const fetchCategory = async (slug) => {
  try {
    const response = await fetch(`/api/marketplace/categories/${slug}`);

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

function CategoryContextProvider({ children, slug }) {
  const [loginDialog, setLoginDialog] = useState(false);
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
    queryKey: ["category-products", slug, filters],
    queryFn: async () => {
      return fetchProducts(slug, filters);
    },
    enabled: !!slug,
  });
  console.log("Category products data:", productsData);
  // Categories query hook with the requested format
  const {
    isLoading: isCategoriesLoading,
    error: categoriesError,
    data: categoriesData,
    refetch: refetchCategory,
  } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      return fetchCategory(slug);
    },
    enabled: !!slug,
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
    enabled: !!slug,
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
  const openLoginDialog = () => {
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
    <CategoryContext.Provider
      value={{
        // Auth
        loginDialog,
        openLoginDialog,
        closeLoginDialog,

        // Data
        products: optimisticProducts,
        totalProducts: productsData?.totalProducts || 0,
        isProductsLoading,
        isProductsFetching,
        productsError,
        refetchProducts,

        // Category data (single category object)
        category: categoriesData || null,
        isCategoriesLoading,
        categoriesError,
        refetchCategory,

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

        // Optimistic updates
        addOptimisticWishlist,
        removeOptimisticWishlist,
        addOptimisticCart,
        removeOptimisticCart,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

function useCategoryContext() {
  return useContext(CategoryContext);
}

export { useCategoryContext, CategoryContextProvider };
