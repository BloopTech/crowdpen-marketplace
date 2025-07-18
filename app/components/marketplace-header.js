"use client";
import React, { useState } from "react";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  ArrowLeft,
  LoaderCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../components/ui/navigation-menu";
import { categories } from "../lib/data";
import Link from "next/link";
import logo from "../../public/crowdpen_icon.png";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { UserId } from "./ui/userId";
import { useHome } from "../context";
import { useRouter } from "next/navigation";
import { useCrowdpenSSO } from "../hooks/useCrowdpenSSO";

export default function MarketplaceHeader(props) {
  const { searchQuery, onSearchChange, onSearch, cartItemCount } = props;
  const { openLoginDialog } = useHome();
  const { data: session } = useSession();
  const router = useRouter();
  const { isCheckingSSO, ssoAvailable, attemptSSOLogin } = useCrowdpenSSO();

  const [loading, setLoading] = useState(false);

  const createCategory = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/marketplace/categories/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="border-b bg-white sticky top-0 z-5">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white text-xs py-1">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link
            href="https://crowdpen.co"
            className="flex items-center gap-2 hover:text-gray-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to the CrowdPen dashboard</span>
          </Link>
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
      <div className="md:px-10 px-5 py-4 w-full">
        <div className="flex items-center space-x-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <div className="-ml-7">
              <Image
                src={logo}
                alt="logo"
                width={85}
                height={85}
                style={{ height: "auto" }}
                priority
                className="dark:invert"
              />
            </div>
            <h1 className="text-xl font-bold hidden sm:block">
              CrowdPen Market
            </h1>
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
              <Button
                onClick={onSearch}
                size="sm"
                className="absolute right-1 top-1 h-8"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-2">
            {session ? (
              <UserId />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={ssoAvailable ? attemptSSOLogin : openLoginDialog}
                disabled={isCheckingSSO}
              >
                {isCheckingSSO ? (
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <User className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">
                  {isCheckingSSO ? "Checking..." : "Account"}
                </span>
              </Button>
            )}
            {session ? (
              <Link href="/wishlist">
                <Button variant="ghost" size="sm">
                  <Heart className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Wishlist</span>
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={ssoAvailable ? attemptSSOLogin : openLoginDialog}
                disabled={isCheckingSSO}
              >
                {isCheckingSSO ? (
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">
                  {isCheckingSSO ? "Checking..." : "Wishlist"}
                </span>
              </Button>
            )}

            {session ? (
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
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={ssoAvailable ? attemptSSOLogin : openLoginDialog}
                disabled={isCheckingSSO}
              >
                {isCheckingSSO ? (
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">
                  {isCheckingSSO ? "Checking..." : "Cart"}
                </span>
              </Button>
            )}
            <Button
              size="sm"
              className="relative bg-black text-white rounded-md border border-black hover:bg-white hover:text-black cursor-pointer"
              onClick={() => router.push("/product/create")}
              //onClick={createCategory}
            >
              Create
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-4">
          <NavigationMenu>
            <NavigationMenuList className="flex-wrap">
              <NavigationMenuItem>
                <NavigationMenuTrigger>All Categories</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-96 gap-3 p-4 bg-white">
                    {categories.map((category) => (
                      <div key={category.name}>
                        <h4 className="font-semibold text-sm mb-2">
                          {category.name}
                        </h4>
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
                  <Link
                    href={`/category/${category.name
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
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
  );
}
