"use client"

import React,{ useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "../../components/ui/button"
import { ArrowLeft } from "lucide-react"
import MarketplaceHeader from "../../components/marketplace-header"
import SearchResults from "../../components/search-results"
import { SearchEngine } from "../../lib/search-engine"
import GoogleSearchBar from "../../components/google-search-bar"

export default function SearchPage() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const [viewMode, setViewMode] = useState("list")
  const [cartItems, setCartItems] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [resources, setResources] = useState([])
  const [searchTime, setSearchTime] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Use local engine for suggestions only, based on current DB results
  const suggestionEngine = useMemo(() => new SearchEngine(resources), [resources])
  const suggestions = useMemo(() => {
    if (!searchQuery) return []
    try {
      return suggestionEngine.getSuggestions(searchQuery)
    } catch {
      return []
    }
  }, [searchQuery, suggestionEngine])

  useEffect(() => {
    const query = searchParams.get("q")
    if (query) {
      setSearchQuery(query)
    }
  }, [searchParams])

  // Fetch results from API whenever search query or filter params change
  useEffect(() => {
    let isActive = true
    const q = (searchQuery || "").trim()
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        // Forward category/subcategory filters from the URL if present
        const allowedFilterKeys = [
          "categoryId",
          "categorySlug",
          "category",
          "subcategoryId",
          "subcategorySlug",
          "subcategory",
        ]
        const qp = new URLSearchParams()
        qp.set("q", q)
        for (const key of allowedFilterKeys) {
          const v = searchParams.get(key)
          if (v) qp.set(key, v)
        }

        const res = await fetch(`/api/marketplace/products/search?${qp.toString()}`,
        {
          signal: controller.signal,
        })
        if (!res.ok) {
          // Try to surface server error message
          let errMsg = res.statusText
          try {
            const body = await res.json()
            errMsg = body?.error || body?.message || errMsg
          } catch {
            // ignore json parse errors
          }
          throw new Error(errMsg || "Search request failed")
        }
        const data = await res.json()
        if (!isActive) return
        setResources(Array.isArray(data?.results) ? data.results : [])
        setSearchTime(Number.isFinite(data?.searchTime) ? data.searchTime : 0)
      } catch (err) {
        if (!isActive) return
        setError(err?.message || "Failed to fetch search results")
        setResources([])
        setSearchTime(0)
      } finally {
        if (isActive) setLoading(false)
      }
    }, 300)

    return () => {
      isActive = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, searchParams])

  const handleAddToCart = (resourceId) => {
    setCartItems((prev) => [...prev, resourceId])
  }

  const handleToggleWishlist = (resourceId) => {
    setWishlist((prev) => (prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]))
  }

  const handleSearch = (query) => {
    const q = typeof query === "string" ? query : (searchQuery || "")
    setSearchQuery(q)
    // Update URL without page reload
    const url = new URL(window.location.href)
    url.searchParams.set("q", q)
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
        {/* Centered Google-style search bar */}
        <div className="mb-6">
          <GoogleSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            suggestions={suggestions}
            showSuggestions={true}
            onSuggestionClick={(s) => handleSearch(s)}
          />
        </div>

        <div className="flex items-center gap-2 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browse
            </Button>
          </Link>
        </div>

        {error && (
          <div className="text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-muted-foreground text-sm">Searching...</div>
        ) : (
          <SearchResults
            resources={resources}
            query={searchQuery}
            searchTime={searchTime}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
        )}
      </div>
    </div>
  )
}
