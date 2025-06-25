"use client"

import Image from "next/image"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Heart, ShoppingCart, Star, Download, FileText } from "lucide-react"
import Link from "next/link"


export default function ProductCard({ resource, onAddToCart, onToggleWishlist }) {
  const discountPercentage = resource.originalPrice
    ? Math.round(((resource.originalPrice - resource.price) / resource.originalPrice) * 100)
    : 0

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-sm">
      <CardContent className="p-0">
        {/* Image Container */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg bg-gradient-to-br from-purple-50 to-pink-50">
          <Image
            src={resource.images[0] || "/placeholder.svg"}
            alt={resource.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {resource.featured && <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Bestseller</Badge>}
            {discountPercentage > 0 && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white">-{discountPercentage}%</Badge>
            )}
          </div>

          {/* Wishlist Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
            onClick={() => onToggleWishlist(resource.id)}
          >
            <Heart className="h-4 w-4" />
          </Button>

          {/* Quick Actions Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Link href={`/product/${resource.id}`}>
              <Button variant="secondary" size="sm">
                Preview
              </Button>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category */}
          <div className="text-xs text-muted-foreground mb-1">
            {resource.category} › {resource.subcategory}
          </div>

          {/* Title */}
          <Link href={`/product/${resource.id}`}>
            <h3 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-purple-600 cursor-pointer">
              {resource.title}
            </h3>
          </Link>

          {/* Author */}
          <div className="flex items-center gap-1 mb-2">
            <Link href={`/author/${resource.author.toLowerCase().replace(/\s+/g, "-")}`}>
              <span className="text-xs text-purple-600 hover:underline cursor-pointer">{resource.author}</span>
            </Link>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs text-muted-foreground">
                {resource.authorRating} ({resource.authorSales.toLocaleString()})
              </span>
            </div>
          </div>

          {/* Rating & Reviews */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.floor(resource.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">({resource.reviewCount})</span>
          </div>

          {/* Features */}
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span>{resource.deliveryTime}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>{resource.fileType}</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold">${resource.price}</span>
            {resource.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">${resource.originalPrice}</span>
            )}
          </div>

          {/* Add to Cart Button */}
          <Button onClick={() => onAddToCart(resource.id)} className="w-full" size="sm">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
