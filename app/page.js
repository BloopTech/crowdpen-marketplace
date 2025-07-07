"use client"

import React, { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Button } from "./components/ui/button";
import { LayoutGrid, List, Filter } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./components/ui/sheet";
import MarketplaceHeader from "./components/marketplace-header";
import FilterSidebar from "./components/filter-sidebar";
import ProductCard from "./components/product-card";
import { mockResources } from "./lib/data";
import { useRouter } from "next/navigation";

export default function AmazonStyleMarketplace() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [cartItems, setCartItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [filters, setFilters] = useState({
    category: "All",
    priceRange: [0, 200],
    rating: 0,
    deliveryTime: "",
    license: "",
    sortBy: "featured",
  })

  const filteredResources = useMemo(() => {
    const filtered = mockResources.filter((resource) => {
      // Search filter
      const matchesSearch =
        appliedSearch === "" ||
        resource.title.toLowerCase().includes(appliedSearch.toLowerCase()) ||
        resource.description.toLowerCase().includes(appliedSearch.toLowerCase()) ||
        resource.tags.some((tag) => tag.toLowerCase().includes(appliedSearch.toLowerCase()))

      // Category filter
      const matchesCategory = filters.category === "All" || resource.category === filters.category

      // Price filter
      const matchesPrice = resource.price >= filters.priceRange[0] && resource.price <= filters.priceRange[1]

      // Rating filter
      const matchesRating = filters.rating === 0 || resource.rating >= filters.rating

      // License filter
      const matchesLicense = filters.license === "" || resource.license.includes(filters.license)

      // Delivery filter
      const matchesDelivery = filters.deliveryTime === "" || resource.deliveryTime === filters.deliveryTime

      return matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesLicense && matchesDelivery
    })

    // Sort resources
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "price-low":
          return a.price - b.price
        case "price-high":
          return b.price - a.price
        case "rating":
          return b.rating - a.rating
        case "newest":
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        case "popular":
          return b.downloads - a.downloads
        default: // featured
          return b.featured ? 1 : -1
      }
    })

    return filtered
  }, [appliedSearch, filters])

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
    } else {
      setAppliedSearch(searchQuery)
    }
  }

  const handleAddToCart = (resourceId) => {
    setCartItems((prev) => [...prev, resourceId])
  }

  const handleToggleWishlist = (resourceId) => {
    setWishlist((prev) => (prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]))
  }

  const handleClearFilters = () => {
    setFilters({
      category: "All",
      priceRange: [0, 200],
      rating: 0,
      deliveryTime: "",
      license: "",
      sortBy: "featured",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={handleSearch}
        cartItemCount={cartItems.length}
      />

      <div className="container mx-auto px-4 py-6 mt-[4rem]">
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <FilterSidebar filters={filters} onFiltersChange={setFilters} onClearFilters={handleClearFilters} />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {filteredResources.length.toLocaleString()} results
                  {appliedSearch && ` for "${appliedSearch}"`}
                </span>

                {/* Mobile Filter Button */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <FilterSidebar filters={filters} onFiltersChange={setFilters} onClearFilters={handleClearFilters} />
                  </SheetContent>
                </Sheet>
              </div>

              <div className="flex items-center gap-4">
                {/* Sort */}
                <Select value={filters.sortBy} onValueChange={(value) => setFilters({ ...filters, sortBy: value })}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Customer Rating</SelectItem>
                    <SelectItem value="newest">Newest Arrivals</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Toggle */}
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 p-0"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 w-8 p-0"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {filteredResources.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
                <Button onClick={handleClearFilters}>Clear all filters</Button>
              </div>
            ) : (
              <div
                className={`grid gap-4 ${
                  viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
                }`}
              >
                {filteredResources.map((resource) => (
                  <ProductCard
                    key={resource.id}
                    resource={resource}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={handleToggleWishlist}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
