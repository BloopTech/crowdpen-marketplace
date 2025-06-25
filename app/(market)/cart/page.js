"use client"

import React,{ useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Separator } from "../../components/ui/separator"
import { Badge } from "../../components/ui/badge"
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft } from "lucide-react"
import { mockResources } from "../../lib/data"
import MarketplaceHeader from "../../components/marketplace-header"

export default function CartPage() {
  const [cartItems, setCartItems] = useState([
    { id: "1", quantity: 1, variationId: "1a" },
    { id: "2", quantity: 1 },
    { id: "3", quantity: 1 },
  ])
  const [promoCode, setPromoCode] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const cartProducts = cartItems
    .map((item) => {
      const product = mockResources.find((p) => p.id === item.id)
      const variation = product?.variations?.find((v) => v.id === item.variationId)
      return {
        ...item,
        product,
        variation,
        price: variation?.price || product?.price || 0,
      }
    })
    .filter((item) => item.product)

  const subtotal = cartProducts.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.08 // 8% tax
  const total = subtotal + tax

  const updateQuantity = (id, newQuantity) => {
    if (newQuantity === 0) {
      setCartItems((prev) => prev.filter((item) => item.id !== id))
    } else {
      setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)))
    }
  }

  const removeItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id))
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
              Continue Shopping
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Shopping Cart ({cartItems.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cartProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
                    <p className="text-muted-foreground mb-4">Add some resources to get started</p>
                    <Link href="/">
                      <Button>Browse Resources</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cartProducts.map((item) => (
                      <div key={`${item.id}-${item.variationId}`} className="flex gap-4 p-4 border rounded-lg">
                        <div className="relative w-20 h-24 shrink-0 rounded-md overflow-hidden">
                          <Image
                            src={item.product.images[0] || "/placeholder.svg"}
                            alt={item.product.title}
                            fill
                            className="object-cover"
                          />
                        </div>

                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{item.product.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">by {item.product.author}</p>
                          {item.variation && (
                            <Badge variant="secondary" className="text-xs mb-2">
                              {item.variation.name}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{item.product.fileType}</span>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">{item.product.deliveryTime}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="text-lg font-bold">${item.price}</div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                  <Button variant="outline" className="w-full">
                    Apply Code
                  </Button>
                </div>

                <Link href="/checkout">
                  <Button className="w-full" size="lg" disabled={cartProducts.length === 0}>
                    Proceed to Checkout
                  </Button>
                </Link>

                <div className="text-xs text-muted-foreground text-center">
                  Secure checkout • Instant download • 30-day money-back guarantee
                </div>
              </CardContent>
            </Card>

            {/* Trust Badges */}
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium">Why shop with us?</div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>✓ Instant download after purchase</div>
                    <div>✓ 30-day money-back guarantee</div>
                    <div>✓ Secure payment processing</div>
                    <div>✓ 24/7 customer support</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
