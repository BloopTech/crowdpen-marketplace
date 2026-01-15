"use client";
import React, { createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const ProductContext = createContext();

function ProductContextProvider({ children }) {
  const {
    isLoading: categoriesLoading,
    error: categoriesError,
    data: categoriesData,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: [`categories`],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/categories`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json().catch(() => ([]));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to fetch categories");
      }
      return data;
    },
  });

  return (
    <ProductContext.Provider
      value={{
        categoriesLoading,
        categoriesError,
        categoriesData,
        refetchCategories,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

function useProductContext() {
  return useContext(ProductContext);
}

export { ProductContextProvider, useProductContext };
