"use client"

import React,{ useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "../../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Badge } from "../../../components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { Avatar, AvatarFallback } from "../../../components/ui/avatar"
import { Star, Users, Download, Heart, MapPin, Calendar, Award, TrendingUp } from "lucide-react"
import { mockResources } from "../../../lib/data"
import MarketplaceHeader from "../../../components/marketplace-header"
import ProductCard from "../../../components/product-card"

export default function AuthorProfilePage() {
  const params = useParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [cartItems, setCartItems] = useState([])
  const [wishlist, setWishlist] = useState([])

  // Mock author data - in real app, fetch by params.id
  const author = {
    id: "1",
    name: "Publishing Pro",
    avatar: "/placeholder.svg?height=100&width=100",
    bio: "Experienced content creator and bestselling author with over 10 years in the publishing industry. Specializes in helping new authors navigate the complex world of self-publishing and book marketing.",
    location: "New York, NY",
    joinDate: "2020-03-15",
    totalSales: 15420,
    rating: 4.9,
    reviewCount: 1250,
    followers: 8900,
    specialties: ["Self-Publishing", "Book Marketing", "Content Strategy", "Author Branding"],
    achievements: ["Bestselling Author", "Top 1% Creator", "10K+ Sales", "Expert Verified"],
  }

  const authorProducts = mockResources.filter((product) => product.author === author.name)

  const handleAddToCart = (resourceId) => {
    setCartItems((prev) => [...prev, resourceId])
  }

  const handleToggleWishlist = (resourceId) => {
    setWishlist((prev) => (prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]))
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
        {/* Author Header */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-32 w-32 mx-auto md:mx-0">
                <AvatarFallback className="text-2xl">
                  {author.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
                  <h1 className="text-3xl font-bold">{author.name}</h1>
                  <div className="flex flex-wrap gap-1 justify-center md:justify-start">
                    {author.achievements.map((achievement) => (
                      <Badge key={achievement} variant="secondary" className="text-xs">
                        <Award className="h-3 w-3 mr-1" />
                        {achievement}
                      </Badge>
                    ))}
                  </div>
                </div>

                <p className="text-muted-foreground mb-4">{author.bio}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{author.rating}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      Rating
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{author.totalSales.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Download className="h-3 w-3" />
                      Sales
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{author.followers.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Users className="h-3 w-3" />
                      Followers
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{authorProducts.length}</div>
                    <div className="text-xs text-muted-foreground">Products</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 justify-center md:justify-start">
                  <Button>
                    <Heart className="h-4 w-4 mr-2" />
                    Follow Author
                  </Button>
                  <Button variant="outline">Message</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Author Content */}
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="products">Products ({authorProducts.length})</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({author.reviewCount})</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {authorProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  resource={product}
                  onAddToCart={handleAddToCart}
                  onToggleWishlist={handleToggleWishlist}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>About {author.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>{author.bio}</p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{author.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Member since {new Date(author.joinDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Specialties</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {author.specialties.map((specialty) => (
                      <Badge key={specialty} variant="outline">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarFallback>U{i}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">User {i}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, j) => (
                              <Star key={j} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Excellent creator with high-quality resources. Very helpful and responsive to questions.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Revenue</span>
                    <span className="font-bold">$125,000+</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Rating</span>
                    <span className="font-bold">{author.rating}/5.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Response Rate</span>
                    <span className="font-bold">98%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Repeat Customers</span>
                    <span className="font-bold">65%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <div className="font-medium">New product launched</div>
                    <div className="text-muted-foreground">2 days ago</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Reached 15K sales milestone</div>
                    <div className="text-muted-foreground">1 week ago</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Updated product catalog</div>
                    <div className="text-muted-foreground">2 weeks ago</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
