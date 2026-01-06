"use client";

import { useMemo, useState, useCallback, createContext, useContext } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export const AccountContext = createContext();

export function AccountContextProvider({ children }) {
  const [payoutType, setPayoutType] = useState("bank");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const myProductsSearch = searchParams?.get("q") || "";
  const myProductsSelectedCategory = searchParams?.get("category") || "all";
  const myProductsSortBy = searchParams?.get("sort") || "newest";
  const myProductsStatus = searchParams?.get("status") || "all";

  const updateMyProductsSearchParams = useCallback(
    (updater) => {
      if (!pathname) return;
      const params = new URLSearchParams(searchParams?.toString() || "");
      updater(params);

      const next = params.toString();
      const curr = searchParams?.toString() || "";
      if (next !== curr) router.replace(next ? `${pathname}?${next}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const setMyProductsSearch = useCallback(
    (next) => {
      updateMyProductsSearchParams((params) => {
        const value =
          typeof next === "function" ? next(myProductsSearch) : (next ?? "");
        const v = String(value || "");
        if (v) params.set("q", v);
        else params.delete("q");
      });
    },
    [updateMyProductsSearchParams, myProductsSearch]
  );

  const setMyProductsSelectedCategory = useCallback(
    (next) => {
      updateMyProductsSearchParams((params) => {
        const value =
          typeof next === "function"
            ? next(myProductsSelectedCategory)
            : (next ?? "all");
        const v = String(value || "all");
        if (v && v !== "all") params.set("category", v);
        else params.delete("category");
      });
    },
    [updateMyProductsSearchParams, myProductsSelectedCategory]
  );

  const setMyProductsSortBy = useCallback(
    (next) => {
      updateMyProductsSearchParams((params) => {
        const value =
          typeof next === "function" ? next(myProductsSortBy) : (next ?? "newest");
        const v = String(value || "newest");
        if (v && v !== "newest") params.set("sort", v);
        else params.delete("sort");
      });
    },
    [updateMyProductsSearchParams, myProductsSortBy]
  );

  const setMyProductsStatus = useCallback(
    (next) => {
      updateMyProductsSearchParams((params) => {
        const value =
          typeof next === "function" ? next(myProductsStatus) : (next ?? "all");
        const v = String(value || "all");
        if (v && v !== "all") params.set("status", v);
        else params.delete("status");
      });
    },
    [updateMyProductsSearchParams, myProductsStatus]
  );

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
  const bankListQuery = useQuery({
    queryKey: [
      "bank-list",
      payoutType,
      accountQuery?.bank?.currency || null,
      accountQuery?.bank?.country_code || null,
    ],
    enabled: payoutType === "bank" || payoutType === "mobile_money",
    keepPreviousData: true,
    queryFn: async () => {
      const qs = new URLSearchParams({ type: payoutType || "" });
      if (accountQuery?.bank?.currency) {
        qs.set("currency", String(accountQuery.bank.currency));
      }
      if (accountQuery?.bank?.country_code) {
        qs.set("countryCode", String(accountQuery.bank.country_code));
      }
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
      payoutSummary: accountQuery?.payoutSummary || null,
      payoutTransactions: accountQuery?.payoutTransactions || [],
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

  const categoriesData = categoriesQuery?.data;

  const categories = useMemo(() => {
    const list = Array.isArray(categoriesData) ? categoriesData : [];
    const names = list.map((c) => c?.name).filter(Boolean);
    return Array.from(new Set(names));
  }, [categoriesData]);

  const myProductsQuery = useInfiniteQuery({
    queryKey: [
      "account",
      "my-products",
      value?.profile?.pen_name,
      myProductsSearch,
      myProductsSelectedCategory,
      myProductsSortBy,
      myProductsStatus,
    ],
    enabled: Boolean(value?.profile?.pen_name),
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam || 1),
        limit: "20",
        sortBy: myProductsSortBy || "newest",
      });
      if (myProductsSearch) params.set("search", myProductsSearch);
      if (myProductsSelectedCategory && myProductsSelectedCategory !== "all") {
        params.set("category", myProductsSelectedCategory);
      }
      if (myProductsStatus && myProductsStatus !== "all") {
        params.set("status", myProductsStatus);
      }
      const pen = value?.profile?.pen_name;
      const res = await fetch(
        `/api/marketplace/author/${encodeURIComponent(
          pen
        )}/products?${params.toString()}`,
        { credentials: "include", cache: "no-store" }
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
        myProductsStatus,
        setMyProductsStatus,
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
