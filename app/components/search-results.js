"use client"

import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Download, Star, FileText, LayoutGrid, LayoutList } from "lucide-react"
import Image from "next/image"
import GridCard from "./grid-card"
import Link from "next/link"


export default function SearchResults({ resources, query, searchTime, viewMode, setViewMode }) {
  if (resources.length === 0) {
    return (
      <div className="text-center py-12">
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
    <div className="space-y-4">
      {/* Search Stats */}
      <div className="text-sm text-muted-foreground">
        About {resources.length.toLocaleString()} results ({searchTime}ms)
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
          >
            <LayoutList className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
        </div>
      </div>

      {/* Results View - Conditional rendering based on viewMode */}
      {viewMode === "list" ? (
        <div className="space-y-4">
          {resources.map((resource) => (
            <Card key={resource.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="relative w-32 h-24 shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={resource.image || "/placeholder.svg"}
                      alt={resource.title}
                      fill
                      className="object-cover"
                    />
                    {resource.featured && (
                      <Badge className="absolute top-1 left-1 text-xs bg-orange-500">Featured</Badge>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <Link href={`/product/${resource.id}`}>
                          <h3 className="text-lg font-semibold text-blue-600 hover:underline cursor-pointer mb-1">
                            {resource.title}
                          </h3>
                        </Link>
                        <div className="text-sm text-green-600 mb-1">
                          <Link
                            href={`/author/${resource.author.toLowerCase().replace(/\s+/g, "-")}`}
                            className="hover:underline"
                          >
                            {resource.author}
                          </Link>
                          {" • "}
                          {resource.category}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">${resource.price}</div>
                        <Button size="sm" className="mt-1">
                          Add to Cart
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{resource.description}</p>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{resource.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        <span>{resource.downloads.toLocaleString()}</span>
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
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {resources.map((resource) => (
            <GridCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  )
}
