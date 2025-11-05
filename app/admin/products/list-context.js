"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";

function fetchAdminProducts(qs) {
  const searchParams = new URLSearchParams({
    page: String(qs.page || 1),
    pageSize: String(qs.pageSize || 20),
    sort: qs.sort || "rank",
  });
  if (qs.q) searchParams.set("q", qs.q);
  if (qs.featured && qs.featured !== "all")
    searchParams.set("featured", qs.featured);
  if (qs.flagged && qs.flagged !== "all")
    searchParams.set("flagged", qs.flagged);
  return fetch(`/api/admin/products?${searchParams.toString()}`, {
    credentials: "include",
    cache: "no-store",
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      const message = data?.message || "Failed to fetch products";
      throw new Error(message);
    }
    return data;
  });
}

const AdminProductsContext = createContext(null);

export function AdminProductsProvider({ children }) {
  const qc = useQueryClient();
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      q: parseAsString.withDefault(""),
      featured: parseAsString.withDefault("all"), // all | true | false
      flagged: parseAsString.withDefault("all"), // all | true | false
      sort: parseAsString.withDefault("rank"), // rank | newest | price-low | price-high | rating | downloads
    },
    { clearOnDefault: true }
  );

  const queryKey = useMemo(() => ["admin", "products", qs], [qs]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAdminProducts(qs),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, featured }) => {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, featured }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to update product");
      }
      return data?.data;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old) => {
        const next = { ...(old || {}) };
        next.data = (old?.data || []).map((p) =>
          p.id === vars.id ? { ...p, featured: vars.featured } : p
        );
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const list = useMemo(() => query?.data?.data || [], [query?.data?.data]);
  const loading = query?.isFetching || query?.isLoading;
  const page = query?.data?.page || qs.page || 1;
  const pageSize = query?.data?.pageSize || qs.pageSize || 20;
  const total = query?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const value = useMemo(
    () => ({
      qs,
      setQs,
      list,
      loading,
      page,
      pageSize,
      total,
      totalPages,
      refetch: query.refetch,
      toggleFeatured: (id, featured) => toggleMutation.mutate({ id, featured }),
      togglePending: toggleMutation.isPending,
    }),
    [
      qs,
      setQs,
      list,
      loading,
      page,
      pageSize,
      total,
      totalPages,
      query.refetch,
      toggleMutation,
    ]
  );

  return (
    <AdminProductsContext.Provider value={value}>
      {children}
    </AdminProductsContext.Provider>
  );
}

export function useAdminProducts() {
  const ctx = useContext(AdminProductsContext);
  if (!ctx)
    throw new Error(
      "useAdminProducts must be used within AdminProductsProvider"
    );
  return ctx;
}
