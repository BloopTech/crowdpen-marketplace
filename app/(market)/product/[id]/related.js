"use client";
import React from "react";
import { useProductItemContext } from "./context";
import ProductCard from "../../../components/product-card";
import { Skeleton } from "../../../components/ui/skeleton";
import { AlertCircle } from "lucide-react";

export default function RelatedProducts() {
  const {
    relatedProductsLoading,
    relatedProductsError,
    relatedProductsData,
    productItemData,
  } = useProductItemContext();

  // Don't render if no current product data
  if (!productItemData) {
    return null;
  }

  // Loading state
  if (relatedProductsLoading) {
    return (
      <div className="mt-12" data-testid="related-products-loading">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Related Products
        </h2>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6"
          data-testid="related-products-loading-grid"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (relatedProductsError) {
    return (
      <div className="mt-12" data-testid="related-products-error">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Related Products
        </h2>
        <div
          className="flex items-center justify-center p-8 bg-red-50 rounded-lg"
          data-testid="related-products-error-card"
        >
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 font-medium">
              Failed to load related products
            </p>
            <p className="text-red-600 text-sm mt-1">
              Please try refreshing the page
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No related products found
  if (
    !relatedProductsData?.data?.products ||
    relatedProductsData.data.products.length === 0
  ) {
    return (
      <div className="mt-12" data-testid="related-products-empty">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Related Products
        </h2>
        <div className="text-center p-8 bg-gray-50 dark:bg-slate-900 rounded-lg">
          <p className="text-gray-600 dark:text-slate-400">
            No related products found in the {productItemData.category}{" "}
            category.
          </p>
        </div>
      </div>
    );
  }

  const relatedProducts = relatedProductsData.data.products;
  const category = relatedProductsData.data.category;

  return (
    <div className="mt-12 w-full md:px-10" data-testid="related-products">
      <div
        className="flex items-center justify-between mb-6"
        data-testid="related-products-header"
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Related Products
        </h2>
        <span
          className="text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 px-3 py-1 rounded-full"
          data-testid="related-products-category"
        >
          {category}
        </span>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        data-testid="related-products-grid"
      >
        {relatedProducts.map((product) => (
          <ProductCard key={product.id} resource={product} />
        ))}
      </div>

      {relatedProducts.length > 0 && (
        <p
          className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6"
          data-testid="related-products-footer"
        >
          Showing {relatedProducts.length} related product
          {relatedProducts.length !== 1 ? "s" : ""} from the {category} category
        </p>
      )}
    </div>
  );
}
