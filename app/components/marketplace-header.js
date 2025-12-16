"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  UserPlus,
  LogIn,
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
import millify from "millify";

export default function MarketplaceHeader(props) {
  const { searchQuery, onSearchChange, onSearch } = props;
  const { openLoginDialog, wishlistCountData, cartCountData } = useHome();
  const { data: session } = useSession();
  const router = useRouter();
  const { isCheckingSSO, ssoAvailable, attemptSSOLogin } = useCrowdpenSSO();

  const [loading, setLoading] = useState(false);
  console.log("cartCountData", cartCountData);

  const handleCreateClick = () => {
    router.push("/product/create");
  };

  return (
    <header className="border-b bg-white sticky top-0 z-10 border-slate-300 w-full">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white text-xs py-1 px-5 md:px-10 w-full">
        <div className="flex justify-between items-center gap-3 w-full min-w-0">
          <Link
            href="https://crowdpen.co"
            className="flex items-center gap-2 hover:text-gray-300 transition-colors min-w-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowLeft className="h-3 w-3 shrink-0" />
            <span className="truncate hidden sm:inline">
              Back to the CrowdPen dashboard
            </span>
            <span className="truncate sm:hidden">Back</span>
          </Link>
          <div className="flex items-center gap-4 shrink-0">
            {/* <Link href="/creator/apply" className="hover:text-gray-300">
              <span>Become a Merchant</span>
            </Link> */}
            <Link href="/help" className="hover:text-gray-300">
              <span>Help & Support</span>
            </Link>
          </div>
        </div>
      </div>
      {/* Main Header */}
      <div className="md:px-10 px-5 py-4 w-full">
        <div className="flex flex-wrap items-center justify-between w-full gap-3 min-w-0">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center hover:opacity-80 transition-opacity space-x-1 shrink-0"
          >
            <div>
              <Image
                src={logo}
                alt="logo"
                width={30}
                height={30}
                priority
                className="dark:invert w-fit h-fit"
              />
            </div>
            <h1 className="text-xl font-bold hidden sm:block">
              Marketplace
            </h1>
          </Link>

          {/* Search Bar */}
          <div className="order-3 w-full md:order-none md:flex-1 min-w-0">
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
          <div className="order-2 md:order-none flex items-center gap-1 sm:gap-2 shrink-0">
            {session ? (
              <>
                <UserId />

                <Link href="/wishlist">
                  <Button variant="ghost" size="sm" className="relative px-2 sm:px-3">
                    <Heart className="h-4 w-4" />
                    <span className="hidden sm:inline">Wishlist</span>
                    {wishlistCountData?.count > 0 && (
                      <Badge
                        variant="error"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      >
                        {wishlistCountData?.count > 99
                          ? "99+"
                          : millify(wishlistCountData?.count)}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <Link href="/cart">
                  <Button variant="ghost" size="sm" className="relative px-2 sm:px-3">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="hidden sm:inline">Cart</span>
                    {cartCountData?.count > 0 && (
                      <Badge
                        variant="error"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      >
                        {cartCountData?.count > 99
                          ? "99+"
                          : millify(cartCountData?.count)}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <Button
                  size="sm"
                  className="relative bg-black text-white rounded-md border border-black hover:bg-white hover:text-black cursor-pointer"
                  onClick={handleCreateClick}
                  //onClick={createCategory}
                >
                  Create
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-start">
                  <Button
                    size="sm"
                    aria-label="Log in"
                    onClick={() => openLoginDialog("login")}
                    className="bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 hover:text-gray-900"
                  >
                    <LogIn className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Log in</span>
                  </Button>
                </div>
                <div className="flex flex-col items-start">
                  <Button
                    size="sm"
                    aria-label="Join"
                    onClick={() => openLoginDialog("signup")}
                    className="bg-[#d3a155] text-black shadow-sm hover:bg-black hover:text-[#d3a155]"
                  >
                    <UserPlus className="h-4 w-4 sm:mr-2" />

                    <span className="hidden sm:inline">Join</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-4">
          <NavigationMenu>
            <NavigationMenuList className="flex-wrap">
              <NavigationMenuItem>
                <NavigationMenuTrigger>All Categories</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[calc(100vw-2rem)] sm:w-96 gap-3 p-4 bg-white">
                    {categories.map((category) => (
                      <div key={category.name}>
                        <h4 className="font-semibold text-sm mb-2">
                          {category.name}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
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
