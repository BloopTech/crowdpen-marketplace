"use client"

import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Download, Star, FileText, LayoutGrid, LayoutList, Sparkles, Crown } from "lucide-react"
import Image from "next/image"
import GridCard from "./grid-card"
import Link from "next/link"
import { StatusPill } from "./status-pill"
import { useViewerCurrency } from "../hooks/use-viewer-currency"
import { htmlToText } from "../lib/sanitizeHtml"
import { useHome } from "../context"
import { useSession } from "next-auth/react"


export default function SearchResults({
  resources,
  query,
  searchTime,
  viewMode,
  setViewMode,
  dataTestId,
}) {
  const { openLoginDialog } = useHome()
  const { data: session } = useSession()
  const testId = dataTestId || "search-results"
  const { viewerCurrency, viewerFxRate } = useViewerCurrency("USD")
  const displayCurrency = (viewerCurrency || "USD").toString().toUpperCase()
  const displayRate = Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1
  const fmt = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0) * displayRate)

  if (resources.length === 0) {
    return (
      <div
        className="text-center py-12"
        data-testid={`${testId}-empty`}
      >
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-semibold mb-2">No results found</h3>
        <p className="text-muted-foreground mb-4">Try different keywords or check your spelling</p>
        <div className="text-sm text-muted-foreground">
          Search tips: Use quotes for exact phrases, or try operators like type:template
        </div>
      </div>
    )
  }

  return (
    <div
      className="space-y-4"
      data-testid={testId}
    >
      {/* Search Stats */}
      <div className="text-sm text-muted-foreground" data-testid={`${testId}-stats`}>
        About {resources.length.toLocaleString("en-US")} results ({searchTime}ms)
        {query && (
          <span className="ml-2">
            for <strong>&quot;{query}&quot;</strong>
          </span>
        )}
      </div>
      <div className="flex justify-between items-center mb-4">
        <div></div> {/* Empty div for flex spacing */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 w-8 p-0"
            data-testid={`${testId}-view-list`}
          >
            <LayoutList className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
            data-testid={`${testId}-view-grid`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
        </div>
      </div>

      {/* Results View - Conditional rendering based on viewMode */}
      {viewMode === "list" ? (
        <div className="space-y-4" data-testid={`${testId}-list`}>
          {resources.map((resource) => {
            const isOutOfStock =
              resource?.inStock === false ||
              (resource?.stock !== null && typeof resource?.stock !== "undefined" && Number(resource?.stock) <= 0);
            return (
            <Card
              key={resource.id}
              className="hover:shadow-md transition-shadow"
              data-testid={`${testId}-item-${resource.id}`}
            >
              <CardContent className="p-0">
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="relative w-32 h-24 shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={resource.image || "/placeholder.svg"}
                      alt={resource.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority
                    />
                    <div className="absolute top-1 left-1 flex flex-col gap-2">
                      {resource.featured && (
                        <StatusPill
                          icon={Sparkles}
                          label="Featured"
                          className="bg-orange-500/90 backdrop-blur"
                        />
                      )}
                      {resource.isBestseller && (
                        <StatusPill
                          icon={Crown}
                          label="Bestseller"
                          className="bg-amber-500/90 backdrop-blur"
                        />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <Link
                          href={`/product/${resource.id}`}
                          data-testid={`${testId}-item-link-${resource.id}`}
                        >
                          <h3
                            className="text-lg font-semibold text-foreground hover:text-tertiary hover:underline cursor-pointer mb-1"
                            data-testid={`${testId}-item-title-${resource.id}`}
                          >
                            {resource.title}
                          </h3>
                        </Link>
                        <div className="text-sm text-muted-foreground mb-1">
                          <Link
                            href={`/author/${resource.author.toLowerCase().replace(/\s+/g, "-")}`}
                            className="hover:text-tertiary hover:underline"
                            data-testid={`${testId}-author-${resource.id}`}
                          >
                            {resource.author}
                          </Link>
                          {" • "}
                          {resource.category}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-2xl font-bold"
                          data-testid={`${testId}-price-${resource.id}`}
                        >
                          {fmt(resource.price)}
                        </div>
                        <div className="text-xs mt-1" data-testid={`${testId}-stock-${resource.id}`}>
                          {isOutOfStock ? (
                            <Badge
                              className="bg-red-800/90 text-white text-xs"
                              data-testid={`${testId}-stock-badge-${resource.id}`}
                            >
                              Out of stock
                            </Badge>
                          ) : typeof resource?.stock !== "undefined" && resource?.stock !== null ? (
                            `In stock: ${resource?.stock}`
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          className="mt-1"
                          disabled={isOutOfStock}
                          onClick={() => {
                            if (isOutOfStock) return
                            if (!session?.user?.id) {
                              openLoginDialog("login")
                            }
                          }}
                          data-testid={`${testId}-add-${resource.id}`}
                        >
                          {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{htmlToText(resource.description)}</p>

                    {/* Metadata */}
                    <div
                      className="flex items-center gap-4 text-xs text-muted-foreground"
                      data-testid={`${testId}-meta-${resource.id}`}
                    >
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{resource.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        <span>{resource.downloads.toLocaleString("en-US")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{resource.fileType}</span>
                      </div>
                      <div>{resource.fileSize}</div>
                      <Badge variant="outline" className="text-xs">
                        {resource.license}
                      </Badge>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {resource.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" data-testid={`${testId}-grid`}>
          {resources.map((resource) => (
            <GridCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  )
}
