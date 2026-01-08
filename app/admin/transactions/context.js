"use client";

import React, { createContext, useContext, useEffect, useMemo, useCallback } from "react";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { useAdmin } from "../context";

const AdminTransactionsContext = createContext(undefined);

export function AdminTransactionsProvider({ children }) {
  const { transactionsQuery, transactionsParams, setTransactionsParams } = useAdmin();
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      from: parseAsString.withDefault(""),
      to: parseAsString.withDefault(""),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    setTransactionsParams((p) => ({
      ...p,
      page: qs.page,
      pageSize: qs.pageSize,
      from: qs.from,
      to: qs.to,
    }));
    transactionsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => transactionsQuery?.data?.data || [], [transactionsQuery?.data?.data]);
  const loading = transactionsQuery?.isFetching || transactionsQuery?.isLoading;
  const page = transactionsQuery?.data?.page || transactionsParams.page || 1;
  const pageSize = transactionsQuery?.data?.pageSize || transactionsParams.pageSize || 20;
  const total = transactionsQuery?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fmt = useCallback((v, currency) => {
    const cur = (currency || "").toString().trim().toUpperCase();
    const code = /^[A-Z]{3}$/.test(cur) ? cur : "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));
  }, []);

  const setDate = useCallback(
    (key, value) => {
      setTransactionsParams((p) => ({ ...p, page: 1, [key]: value }));
      setQs({ [key]: value, page: 1 });
    },
    [setTransactionsParams, setQs]
  );

  const setPageSizeValue = useCallback(
    (value) => {
      setTransactionsParams((p) => ({ ...p, page: 1, pageSize: value }));
      setQs({ pageSize: value, page: 1 });
    },
    [setTransactionsParams, setQs]
  );

  const setPageValue = useCallback(
    (value) => {
      setTransactionsParams((p) => ({ ...p, page: value }));
      setQs({ page: value });
      transactionsQuery.refetch();
    },
    [setTransactionsParams, setQs, transactionsQuery]
  );

  const refetch = useCallback(() => transactionsQuery.refetch(), [transactionsQuery]);

  const value = useMemo(
    () => ({
      list,
      loading,
      page,
      pageSize,
      totalPages,
      params: transactionsParams,
      fmt,
      setFrom: (v) => setDate("from", v),
      setTo: (v) => setDate("to", v),
      setPage: setPageValue,
      setPageSize: setPageSizeValue,
      refetch,
    }),
    [
      list,
      loading,
      page,
      pageSize,
      totalPages,
      transactionsParams,
      fmt,
      setDate,
      setPageValue,
      setPageSizeValue,
      refetch,
    ]
  );

  return (
    <AdminTransactionsContext.Provider value={value}>
      {children}
    </AdminTransactionsContext.Provider>
  );
}

export function useAdminTransactions() {
  const ctx = useContext(AdminTransactionsContext);
  if (!ctx) {
    throw new Error("useAdminTransactions must be used within AdminTransactionsProvider");
  }
  return ctx;
}
