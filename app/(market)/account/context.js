"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export const AccountContext = createContext();

export function AccountContextProvider({ children }) {
  const [payoutType, setPayoutType] = useState("bank");
  const [myProductsSearch, setMyProductsSearch] = useState("");
  const [myProductsSelectedCategory, setMyProductsSelectedCategory] =
    useState("all");
  const [myProductsSortBy, setMyProductsSortBy] = useState("newest");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    isLoading: accountQueryLoading,
    error: accountQueryError,
    data: accountQuery,
    refetch: refetchAccountQuery,
  } = useQuery({
    queryKey: ["account", "me"],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/account`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to fetch account");
      }
      return data;
    },
  });
  console.log("accountQuery", accountQuery);
  const bankListQuery = useQuery({
    queryKey: ["bank-list", payoutType],
    enabled: payoutType === "bank" || payoutType === "mobile_money",
    keepPreviousData: true,
    queryFn: async () => {
      const qs = new URLSearchParams({ type: payoutType || "" });
      const res = await fetch(
        `/api/marketplace/startbutton/bank-list?${qs.toString()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to fetch bank list");
      }
      return data;
    },
  });

  const value = useMemo(
    () => ({
      profile: accountQuery?.profile,
      purchases: accountQuery?.purchases || [],
      kyc: accountQuery?.kyc || null,
      bank: accountQuery?.bank || null,
      accountQuery,
    }),
    [accountQuery]
  );

  const categoriesQuery = useQuery({
    queryKey: ["marketplace", "categories"],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/categories`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch categories");
      }
      return data;
    },
  });

  const categories = useMemo(() => {
    const list = Array.isArray(categoriesQuery?.data)
      ? categoriesQuery.data
      : [];
    const names = list.map((c) => c?.name).filter(Boolean);
    return Array.from(new Set(names));
  }, [categoriesQuery?.data]);

  useEffect(() => {
    if (!searchParams) return;
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("category") || "all";
    const sort = searchParams.get("sort") || "newest";
    setMyProductsSearch((prev) => (prev !== q ? q : prev));
    setMyProductsSelectedCategory((prev) => (prev !== cat ? cat : prev));
    setMyProductsSortBy((prev) => (prev !== sort ? sort : prev));
  }, [searchParams, setMyProductsSearch, setMyProductsSelectedCategory, setMyProductsSortBy]);

  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams?.toString() || "");
    const currentQ = params.get("q") || "";
    const currentCat = params.get("category") || "all";
    const currentSort = params.get("sort") || "newest";
    if (myProductsSearch) {
      if (currentQ !== myProductsSearch) params.set("q", myProductsSearch);
    } else {
      if (currentQ) params.delete("q");
    }
    if (myProductsSelectedCategory && myProductsSelectedCategory !== "all") {
      if (currentCat !== myProductsSelectedCategory)
        params.set("category", myProductsSelectedCategory);
    } else {
      if (currentCat && currentCat !== "all") params.delete("category");
    }
    if (myProductsSortBy && myProductsSortBy !== "newest") {
      if (currentSort !== myProductsSortBy) params.set("sort", myProductsSortBy);
    } else {
      if (currentSort && currentSort !== "newest") params.delete("sort");
    }
    const next = params.toString();
    const curr = searchParams?.toString() || "";
    if (next !== curr) router.replace(next ? `${pathname}?${next}` : pathname);
  }, [pathname, searchParams, router, myProductsSearch, myProductsSelectedCategory, myProductsSortBy]);

  const myProductsQuery = useInfiniteQuery({
    queryKey: [
      "account",
      "my-products",
      value?.profile?.pen_name,
      myProductsSearch,
      myProductsSelectedCategory,
      myProductsSortBy,
    ],
    enabled: Boolean(value?.profile?.pen_name),
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam || 1),
        limit: "12",
        sortBy: myProductsSortBy || "newest",
      });
      if (myProductsSearch) params.set("search", myProductsSearch);
      if (myProductsSelectedCategory && myProductsSelectedCategory !== "all") {
        params.set("category", myProductsSelectedCategory);
      }
      const pen = value?.profile?.pen_name;
      const res = await fetch(
        `/api/marketplace/author/${encodeURIComponent(
          pen
        )}/products?${params.toString()}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to fetch products");
      }
      return data;
    },
    getNextPageParam: (lastPage) => {
      return lastPage?.pagination?.hasMore
        ? lastPage.pagination.page + 1
        : undefined;
    },
  });

  const myProducts = useMemo(() => {
    const pages = myProductsQuery?.data?.pages || [];
    return pages.flatMap((p) => p?.products || []);
  }, [myProductsQuery?.data?.pages]);

  const myProductsTotal = useMemo(() => {
    return myProductsQuery?.data?.pages?.[0]?.pagination?.total || 0;
  }, [myProductsQuery?.data?.pages]);

  const myProductsHasMore = Boolean(myProductsQuery?.hasNextPage);
  const myProductsLoading = Boolean(
    myProductsQuery?.isFetching && !myProductsQuery?.data
  );
  const myProductsLoadingMore = Boolean(myProductsQuery?.isFetchingNextPage);
  const myProductsError = myProductsQuery?.error
    ? myProductsQuery.error.message || "Failed to fetch products"
    : null;

  const banks = useMemo(() => {
    const list = bankListQuery?.data?.banks;
    if (!Array.isArray(list)) return [];
    const byCode = new Map();
    for (const item of list) {
      const code = String(item?.code ?? "");
      if (!code) continue;
      if (!byCode.has(code)) byCode.set(code, item);
    }
    return Array.from(byCode.values());
  }, [bankListQuery?.data?.banks]);

  const loadingBanks = bankListQuery?.isFetching;

  return (
    <AccountContext.Provider
      value={{
        ...value,
        myProducts,
        myProductsTotal,
        myProductsHasMore,
        myProductsLoading,
        myProductsLoadingMore,
        myProductsError,
        loadMoreMyProducts: myProductsQuery.fetchNextPage,
        myProductsSearch,
        setMyProductsSearch,
        myProductsSelectedCategory,
        setMyProductsSelectedCategory,
        myProductsSortBy,
        setMyProductsSortBy,
        categories,
        categoriesQuery,
        categoriesLoading: categoriesQuery?.isFetching,
        bankListQuery,
        banks,
        loadingBanks,
        payoutType,
        setPayoutType,
        refetchAccountQuery,
        accountQueryLoading,
        accountQueryError,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccount must be used within an AccountContextProvider");
  }
  return context;
}
