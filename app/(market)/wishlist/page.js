"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Heart, ShoppingCart, ArrowLeft, Trash2 } from "lucide-react"
import { mockResources } from "../../lib/data"
import MarketplaceHeader from "../../components/marketplace-header"
import ProductCard from "../../components/product-card"

export default function WishlistPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [cartItems, setCartItems] = useState([])
  const [wishlistItems, setWishlistItems] = useState(["1", "3", "6"])

  const wishlistProducts = mockResources.filter((product) => wishlistItems.includes(product.id))

  const handleAddToCart = (resourceId) => {
    setCartItems((prev) => [...prev, resourceId])
  }

  const handleToggleWishlist = (resourceId) => {
    setWishlistItems((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId],
    )
  }

  const handleClearWishlist = () => {
    setWishlistItems([])
  }

  const handleAddAllToCart = () => {
    setCartItems((prev) => [...prev, ...wishlistItems])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
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

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                My Wishlist ({wishlistItems.length} items)
              </CardTitle>
              <div className="flex gap-2">
                {wishlistItems.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleAddAllToCart}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add All to Cart
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClearWishlist}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Wishlist
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {wishlistProducts.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
                <p className="text-muted-foreground mb-4">Save items you&apos;re interested in to your wishlist</p>
                <Link href="/">
                  <Button>Browse Resources</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {wishlistProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    resource={product}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={handleToggleWishlist}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
