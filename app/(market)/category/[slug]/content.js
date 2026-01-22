"use client"

import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { LayoutGrid, List, Filter, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "../../../components/ui/sheet";
import { PaginationSmart } from "../../../components/ui/pagination";
import MarketplaceHeader from "../../../components/marketplace-header";
import ProductCard from "../../../components/product-card";
import { useCategoryContext } from "./context";
import FilterCategorySidebar from "./filter-sidebar";

export default function CategoryContentPage() {
  const { 
    filters, 
    updateFilters, 
    clearFilters,
    products, 
    totalProducts,
    isProductsLoading,
    productsError,
    category,
    currentPage,
    totalPages,
  } = useCategoryContext();

  
   const [searchQuery, setSearchQuery] = useState("");
   const [viewMode, setViewMode] = useState("grid");
   const [, setCartItems] = useState([]);
   const [wishlistID, setWishlistID] = useState("");
   
  // We don't need the filteredResources useMemo anymore as data is filtered by the API
  // and exposed through the context

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Update context filters instead of local state
      updateFilters({ search: searchQuery.trim() });
    }
  };

  const handleAddToCart = (resourceId) => {
    setCartItems((prev) => [...prev, resourceId]);
  };
  
  // Use clearFilters from context instead

  return (
    <>
      <div className="min-h-screen bg-background" data-testid="category-page">
        <MarketplaceHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
        />

        <div className="container mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24">
                <FilterCategorySidebar
                  filters={filters}
                  onFiltersChange={updateFilters}
                  onClearFilters={clearFilters}
                />
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1">
              {/* Category Header */}
              {category && (
                <div className="mb-6 bg-card text-card-foreground border border-border p-6 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-2">
                        {category.name}
                      </h1>
                      {category.description && (
                        <p className="text-muted-foreground max-w-2xl">
                          {category.description}
                        </p>
                      )}
                    </div>
                    
                  </div>
                  
                </div>
              )}

              {/* Results Header */}
              <div className="flex items-center justify-between mb-6 bg-card text-card-foreground border border-border p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {totalProducts.toLocaleString("en-US")} results
                    {filters.search && ` for "${filters.search}"`}
                  </span>

                  {/* Mobile Filter Button */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="lg:hidden"
                        data-testid="category-filters-toggle"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                      <FilterCategorySidebar
                        filters={filters}
                        onFiltersChange={updateFilters}
                        onClearFilters={clearFilters}
                      />
                    </SheetContent>
                  </Sheet>
                </div>

                <div className="flex items-center gap-4">
                  {/* Sort */}
                  <Select
                    value={filters.sort}
                    onValueChange={(value) => updateFilters({ sort: value })}
                  >
                    <SelectTrigger className="w-48" data-testid="category-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="featured">Featured</SelectItem>
                      <SelectItem value="price-low">
                        Price: Low to High
                      </SelectItem>
                      <SelectItem value="price-high">
                        Price: High to Low
                      </SelectItem>
                      <SelectItem value="rating">Customer Rating</SelectItem>
                      <SelectItem value="newest">Newest Arrivals</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                      <SelectItem value="bestsellers">Bestsellers</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Toggle */}
                  <div className="flex items-center bg-muted rounded-lg p-1">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="h-8 w-8 p-0"
                      data-testid="category-view-grid"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="h-8 w-8 p-0"
                      data-testid="category-view-list"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {isProductsLoading && (
                <div className="flex justify-center items-center py-12 bg-card text-card-foreground border border-border rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading products...</span>
                </div>
              )}
              
              {/* Error State */}
              {productsError && (
                <div className="text-center py-12 bg-card text-card-foreground border border-border rounded-lg">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h3 className="text-xl font-semibold mb-2">
                    Error loading products
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {productsError.message || 'Something went wrong while fetching products'}
                  </p>
                  <Button
                    onClick={() => window.location.reload()}
                    data-testid="category-retry"
                  >
                    Try again
                  </Button>
                </div>
              )}
              
              {/* Products Grid */}
              {!isProductsLoading && !productsError && (
                <>
                  {products.length === 0 ? (
                    <div className="text-center py-12 bg-card text-card-foreground border border-border rounded-lg">
                      <div className="text-6xl mb-4">🔍</div>
                      <h3 className="text-xl font-semibold mb-2">
                        No products found
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Try adjusting your search or filters
                      </p>
                      <Button onClick={clearFilters} data-testid="category-clear-filters">
                        Clear all filters
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`grid gap-4 ${
                          viewMode === "grid"
                            ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                            : "grid-cols-1"
                        }`}
                      >
                        {products.map((product) => (
                          <ProductCard
                            key={product.id}
                            resource={product}
                            onAddToCart={handleAddToCart}
                            setWishlistID={setWishlistID}
                            wishlistID={wishlistID}
                          />
                        ))}
                      </div>
                      
                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="mt-8" data-testid="category-pagination">
                          <PaginationSmart
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={(page) => updateFilters({ page })}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
