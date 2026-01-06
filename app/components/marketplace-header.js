"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  UserPlus,
  LogIn,
  ArrowLeft,
  LoaderCircle,
  X,
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
import { categories as fallbackCategories } from "../lib/data";
import Link from "next/link";
import logo from "../../public/crowdpen_icon.png";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { UserId } from "./ui/userId";
import { useHome } from "../context";
import { useRouter, usePathname } from "next/navigation";
import { useCrowdpenSSO } from "../hooks/useCrowdpenSSO";
import { useDebounce } from "../hooks/use-debounce";
import millify from "millify";

export default function MarketplaceHeader(props) {
  const { searchQuery, onSearchChange, onSearch, hideFilters = false } = props;
  const {
    openLoginDialog,
    wishlistCountData,
    cartCountData,
    categories: contextCategories,
    updateFilters,
    filters,
  } = useHome();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { isCheckingSSO, ssoAvailable, attemptSSOLogin } = useCrowdpenSSO();

  const [showKycBanner, setShowKycBanner] = useState(true);
  const [kycInfo, setKycInfo] = useState({
    kycStatus: undefined,
    kycExempt: undefined,
  });

  useEffect(() => {
    setShowKycBanner(true);
  }, [pathname]);

  useEffect(() => {
    if (!session?.user?.id) {
      setKycInfo({ kycStatus: undefined, kycExempt: undefined });
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/marketplace/account/kyc", {
          signal: controller.signal,
        });
        if (!res.ok) {
          setKycInfo({ kycStatus: undefined, kycExempt: undefined });
          return;
        }
        const data = await res.json();
        const status = data?.kyc?.status ? String(data.kyc.status) : undefined;
        setKycInfo({
          kycStatus: status,
          kycExempt: Boolean(data?.kycExempt),
        });
      } catch (e) {
        if (e?.name === "AbortError") return;
        setKycInfo({ kycStatus: undefined, kycExempt: undefined });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [session?.user?.id]);

  const isKycExempt = (u) => {
    return (
      u?.crowdpen_staff === true ||
      u?.role === "admin" ||
      u?.role === "senior_admin"
    );
  };

  const shouldShowKycBanner =
    session?.user &&
    !isKycExempt(session.user) &&
    !kycInfo.kycExempt &&
    !session.user.merchant &&
    kycInfo.kycStatus !== "approved" &&
    showKycBanner;

  const searchQueryTrimmed = (searchQuery || "").trim();

  const searchBoxRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const debouncedQuery = useDebounce(searchQuery, 250);

  const [loading, setLoading] = useState(false);
  console.log("cartCountData", cartCountData);

  useEffect(() => {
    const q = (debouncedQuery || "").trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsSuggestionsLoading(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    setIsSuggestionsLoading(true);

    (async () => {
      try {
        const qp = new URLSearchParams();
        qp.set("q", q);
        qp.set("limit", "8");
        const res = await fetch(`/api/marketplace/products/search?${qp.toString()}`,
          {
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error(res.statusText || "Failed to fetch suggestions");
        }
        const data = await res.json();
        if (!isActive) return;
        setSuggestions(Array.isArray(data?.results) ? data.results : []);
      } catch (err) {
        if (!isActive || err?.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        if (isActive) setIsSuggestionsLoading(false);
      }
    })();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [debouncedQuery]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      const el = searchBoxRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const handleSearch = () => {
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    if (typeof onSearch === "function") onSearch();
  };

  const handleInputChange = (value) => {
    onSearchChange(value);
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestionIndex((prev) => {
        const next = prev + 1;
        return next >= suggestions.length ? 0 : next;
      });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestionIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? Math.max(suggestions.length - 1, 0) : next;
      });
      return;
    }

    if (e.key === "Enter") {
      if (showSuggestions && activeSuggestionIndex >= 0) {
        e.preventDefault();
        const s = suggestions[activeSuggestionIndex];
        if (s?.id) {
          setShowSuggestions(false);
          setActiveSuggestionIndex(-1);
          router.push(`/product/${s.id}`);
          return;
        }
      }
      handleSearch();
    }
  };

  const availableCategories =
    (contextCategories && contextCategories.length > 0
      ? contextCategories
      : fallbackCategories) || [];

  const getSubcategories = (category) => {
    if (
      Array.isArray(category?.MarketplaceSubCategories) &&
      category.MarketplaceSubCategories.length > 0
    ) {
      return category.MarketplaceSubCategories.map((sub) => ({
        id: sub.id ?? sub.slug ?? sub.name,
        name: sub.name ?? sub.title ?? "",
      })).filter((sub) => sub.name);
    }
    if (Array.isArray(category?.subcategories) && category.subcategories.length) {
      return category.subcategories
        .map((name) => ({ id: name, name }))
        .filter((sub) => sub.name);
    }
    return [];
  };

  const handleCategorySelect = (categoryName) => {
    if (!categoryName || typeof updateFilters !== "function") return;
    updateFilters({
      category: categoryName,
      subcategory: "",
    });
  };

  const handleSubcategorySelect = (categoryName, subcategoryName) => {
    if (
      !categoryName ||
      !subcategoryName ||
      typeof updateFilters !== "function"
    )
      return;
    updateFilters({
      category: categoryName,
      subcategory: subcategoryName,
    });
  };

  const isCategoryActive = (categoryName) =>
    filters?.category && filters.category === categoryName;

  const isSubcategoryActive = (categoryName, subcategoryName) =>
    isCategoryActive(categoryName) &&
    filters?.subcategory === subcategoryName;

  const handleCreateClick = () => {
    router.push("/product/create");
  };

  return (
    <header className="sticky top-0 z-10 w-full border-b border-border bg-background">
      {shouldShowKycBanner && (
        <div className="w-full bg-amber-50 border-b border-amber-100 text-amber-900 px-5 md:px-10 py-2.5 text-sm relative">
          <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">Complete your KYC verification</span>
              <span className="hidden sm:inline text-amber-700 mx-1">•</span>
              <span className="text-amber-800">
                Verify your identity to start selling on Crowdpen.
              </span>
              <Link
                href="/account?tab=verification"
                className="font-semibold underline decoration-amber-400 hover:text-amber-700 ml-1 whitespace-nowrap transition-colors"
              >
                Verify Now &rarr;
              </Link>
            </div>
            <button
              onClick={() => setShowKycBanner(false)}
              className="cursor-pointer text-amber-800 hover:text-amber-600 p-1 rounded-md hover:bg-amber-100 transition-colors shrink-0"
              aria-label="Close banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {/* Top Bar */}
      <div className="w-full bg-gray-900 text-white text-xs py-1 px-5 md:px-10 dark:bg-black">
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
            <div ref={searchBoxRef} className="relative flex">
              <Input
                type="text"
                placeholder="Search for ebooks, guides, templates, and more..."
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                className="pr-12 h-10"
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
              />
              <Button
                onClick={handleSearch}
                size="sm"
                className="absolute right-1 top-1 h-8"
              >
                <Search className="h-4 w-4" />
              </Button>

              {showSuggestions && (searchQueryTrimmed || isSuggestionsLoading) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
                  {isSuggestionsLoading ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      <span>Searching...</span>
                    </div>
                  ) : null}

                  {!isSuggestionsLoading && suggestions.length === 0 && searchQueryTrimmed.length >= 2 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
                  ) : null}

                  {suggestions.map((s, idx) => (
                    <button
                      key={s.id || idx}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-start justify-between gap-3 ${
                        idx === activeSuggestionIndex ? "bg-muted" : ""
                      }`}
                      onMouseEnter={() => setActiveSuggestionIndex(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!s?.id) return;
                        setShowSuggestions(false);
                        setActiveSuggestionIndex(-1);
                        router.push(`/product/${s.id}`);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {(s.author ? `by ${s.author}` : "")}
                          {s.category ? `${s.author ? " · " : ""}${s.category}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}

                  {searchQueryTrimmed.length > 0 ? (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 border-t hover:bg-muted text-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSearch}
                    >
                      Search for &quot;{searchQueryTrimmed}&quot;
                    </button>
                  ) : null}
                </div>
              )}
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
                        {wishlistCountData?.count > 9
                          ? "9+"
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
                        {cartCountData?.count > 9
                          ? "9+"
                          : millify(cartCountData?.count)}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <Button
                  size="sm"
                  className="relative rounded-md border border-input bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
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
                    className="bg-background text-foreground border border-input hover:bg-accent hover:text-accent-foreground"
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
                    className="bg-tertiary text-black shadow-sm hover:bg-primary hover:text-primary-foreground"
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
        {!hideFilters && (
        <div className="mt-4">
          <NavigationMenu>
            <NavigationMenuList className="flex-wrap">
              <NavigationMenuItem>
                <NavigationMenuTrigger>All Categories</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[calc(100vw-2rem)] sm:w-96 gap-3 p-4 bg-popover text-popover-foreground h-auto max-h-[30rem] overflow-y-auto">
                    {availableCategories.map((category) => {
                      const normalizedSubcategories = getSubcategories(category);
                      const categoryKey =
                        category.id ?? category.slug ?? category.name;
                      return (
                      <div key={categoryKey}>
                        <button
                          type="button"
                          className={`cursor-pointer font-semibold text-sm mb-2 text-left transition-colors ${
                            isCategoryActive(category.name)
                              ? "text-primary"
                              : "text-foreground"
                          }`}
                          onClick={() => handleCategorySelect(category.name)}
                        >
                          {category.name}
                        </button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {normalizedSubcategories.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() =>
                                handleSubcategorySelect(category.name, sub.name)
                              }
                              className={`cursor-pointer text-left text-xs p-1 transition-colors ${
                                isSubcategoryActive(category.name, sub.name)
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )})}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {availableCategories?.map((category) => {
                const categorySlug = category.name.toLowerCase().replace(/\s+/g, "-");
                const isActive = pathname === `/category/${categorySlug}`;
                return (
                  <NavigationMenuItem key={category.name}>
                    <Link
                      href={`/category/${categorySlug}`}
                    >
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={isActive ? "text-[#d3a155] hover:text-[#d3a155]" : ""}
                      >
                        {category.name}
                      </Button>
                    </Link>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        )}
      </div>
    </header>
  );
}
