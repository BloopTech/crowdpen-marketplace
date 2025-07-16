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
      return response.json();
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
