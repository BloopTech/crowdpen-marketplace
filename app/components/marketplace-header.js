"use client"
import { Search, ShoppingCart, Heart, User, ArrowLeft } from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../components/ui/navigation-menu"
import { categories } from "../lib/data"
import Link from "next/link"



export default function MarketplaceHeader({
  searchQuery,
  onSearchChange,
  onSearch,
  cartItemCount,
}) {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white text-xs py-1">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <a
            href="https://crowdpen.co"
            className="flex items-center gap-2 hover:text-gray-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to the CrowdPen dashboard</span>
          </a>
          <div className="flex items-center gap-4">
            <Link href="/creator/apply" className="hover:text-gray-300">
              <span>Become a Creator</span>
            </Link>
            <Link href="/help" className="hover:text-gray-300">
              <span>Help & Support</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CP</span>
            </div>
            <h1 className="text-xl font-bold hidden sm:block">CrowdPen Market</h1>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <div className="relative flex">
              <Input
                type="text"
                placeholder="Search for ebooks, guides, templates, and more..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pr-12 h-10"
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
              <Button onClick={onSearch} size="sm" className="absolute right-1 top-1 h-8">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-2">
            <Link href="/account">
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Account</span>
              </Button>
            </Link>
            <Link href="/wishlist">
              <Button variant="ghost" size="sm">
                <Heart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Wishlist</span>
              </Button>
            </Link>
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Cart</span>
                {cartItemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-4">
          <NavigationMenu>
            <NavigationMenuList className="flex-wrap">
              <NavigationMenuItem>
                <NavigationMenuTrigger>All Categories</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-96 gap-3 p-4">
                    {categories.map((category) => (
                      <div key={category.name}>
                        <h4 className="font-semibold text-sm mb-2">{category.name}</h4>
                        <div className="grid grid-cols-2 gap-1">
                          {category.subcategories.map((sub) => (
                            <button
                              key={sub}
                              className="text-left text-xs text-muted-foreground hover:text-foreground p-1"
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {categories.slice(0, 4).map((category) => (
                <NavigationMenuItem key={category.name}>
                  <Link href={`/category/${category.name.toLowerCase().replace(/\s+/g, "-")}`}>
                    <Button variant="ghost" size="sm">
                      {category.name}
                    </Button>
                  </Link>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </div>
    </header>
  )
}
