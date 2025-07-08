"use client"

import React,{ useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "../../components/ui/button"
import { ArrowLeft } from "lucide-react"
import MarketplaceHeader from "../../components/marketplace-header"
import SearchResults from "../../components/search-results"
import { SearchEngine } from "../../lib/search-engine"
import { mockResources } from "../../lib/data"

export default function SearchPage() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const [viewMode, setViewMode] = useState("list")
  const [cartItems, setCartItems] = useState([])
  const [wishlist, setWishlist] = useState([])

  const searchEngine = useMemo(() => new SearchEngine(mockResources), [])

  const searchResults = useMemo(() => {
    const startTime = performance.now()
    const results = searchEngine.search(searchQuery)
    const endTime = performance.now()
    return {
      resources: results,
      searchTime: Math.round(endTime - startTime),
    }
  }, [searchQuery, searchEngine])

  useEffect(() => {
    const query = searchParams.get("q")
    if (query) {
      setSearchQuery(query)
    }
  }, [searchParams])

  const handleAddToCart = (resourceId) => {
    setCartItems((prev) => [...prev, resourceId])
  }

  const handleToggleWishlist = (resourceId) => {
    setWishlist((prev) => (prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]))
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    // Update URL without page reload
    const url = new URL(window.location.href)
    url.searchParams.set("q", query)
    window.history.pushState({}, "", url.toString())
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={handleSearch}
        cartItemCount={cartItems.length}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browse
            </Button>
          </Link>
        </div>

        <SearchResults
          resources={searchResults.resources}
          query={searchQuery}
          searchTime={searchResults.searchTime}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>
    </div>
  )
}
