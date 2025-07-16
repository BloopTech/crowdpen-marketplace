"use client";
import React, { createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  return (
    <ProductItemContext.Provider
      value={{
        productItemLoading,
        productItemError,
        productItemData,
        refetchProductItem,
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
