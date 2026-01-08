"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger } from "nuqs";

function fetchJson(url) {
  return fetch(url, { credentials: "include", cache: "no-store" }).then(
    async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== "success") {
        const message = data?.message || `Failed to fetch ${url}`;
        throw new Error(message);
      }
      return data;
    }
  );
}

const AdminLicensesContext = createContext(undefined);

export function AdminLicensesProvider({ children }) {
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
    },
    { clearOnDefault: true }
  );

  const query = useQuery({
    queryKey: ["admin", "licenses", qs],
    queryFn: () => {
      const sp = new URLSearchParams({
        page: String(qs.page || 1),
        pageSize: String(qs.pageSize || 20),
      });
      return fetchJson(`/api/admin/licenses?${sp.toString()}`);
    },
    keepPreviousData: true,
  });

  const items = useMemo(() => query.data?.data || [], [query.data]);
  const loading = query.isFetching || query.isLoading;
  const page = query.data?.page || qs.page || 1;
  const pageSize = query.data?.pageSize || qs.pageSize || 20;
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const value = useMemo(() => {
    const setPage = (nextPage) => setQs({ page: nextPage });
    const setPageSize = (nextPageSize) =>
      setQs({ pageSize: nextPageSize, page: 1 });
    return {
      qs,
      setQs,
      query,
      items,
      loading,
      page,
      pageSize,
      total,
      totalPages,
      setPage,
      setPageSize,
      refetch: query.refetch,
    };
  }, [qs, setQs, query, items, loading, page, pageSize, total, totalPages]);

  return (
    <AdminLicensesContext.Provider value={value}>
      {children}
    </AdminLicensesContext.Provider>
  );
}

export function useAdminLicenses() {
  const ctx = useContext(AdminLicensesContext);
  if (!ctx) {
    throw new Error(
      "useAdminLicenses must be used within an AdminLicensesProvider"
    );
  }
  return ctx;
}
