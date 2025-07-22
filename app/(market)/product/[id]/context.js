"use client";
import React, { createContext, useContext, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const ProductItemContext = createContext();

function ProductItemContextProvider({ children, id }) {
  const [isCopied, setIsCopied] = useState(false);
  
  const {
    isLoading: productItemLoading,
    error: productItemError,
    data: productItemData,
    refetch: refetchProductItem,
  } = useQuery({
    queryKey: [`productItem-${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/products/item/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch reviews for the product with infinite scroll
  const {
    data: reviewsData,
    error: reviewsError,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status: reviewsStatus,
    refetch: refetchReviews,
  } = useInfiniteQuery({
    queryKey: [`productReviews-${id}`],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(
        `/api/marketplace/products/item/${id}/reviews?page=${pageParam}&limit=10`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      if (lastPage?.data?.pagination?.hasNextPage) {
        return lastPage.data.pagination.currentPage + 1;
      }
      return undefined;
    },
    enabled: !!id,
  });

  const reviewsLoading = reviewsStatus === 'loading';
  
  // Function to share product by copying URL to clipboard
  const shareProduct = () => {
    if (typeof window !== "undefined") {
      const currentUrl = window.location.href;
      navigator.clipboard.writeText(currentUrl)
        .then(() => {
          setIsCopied(true);
          toast.success("Product URL copied to clipboard");
          // Reset copied state after 3 seconds
          setTimeout(() => setIsCopied(false), 3000);
        })
        .catch((err) => {
          console.error("Failed to copy URL: ", err);
          toast.error("Failed to copy URL");
        });
    }
  };
  
  console.log("productItemData", productItemData);
  console.log("reviewsData", reviewsData);
  
  return (
    <ProductItemContext.Provider
      value={{
        productItemLoading,
        productItemError,
        productItemData,
        refetchProductItem,
        reviewsLoading,
        reviewsError,
        reviewsData,
        refetchReviews,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        shareProduct,
        isCopied,
      }}
    >
      {children}
    </ProductItemContext.Provider>
  );
}

function useProductItemContext() {
  return useContext(ProductItemContext);
}

export { ProductItemContextProvider, useProductItemContext };
