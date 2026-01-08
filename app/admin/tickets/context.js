"use client";

import React, { createContext, useContext, useEffect, useMemo, useCallback } from "react";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { useAdmin } from "../context";

const AdminTicketsContext = createContext(undefined);

export function AdminTicketsProvider({ children }) {
  const { ticketsQuery, ticketsParams, setTicketsParams } = useAdmin();
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      q: parseAsString.withDefault(""),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    setTicketsParams((p) => ({
      ...p,
      page: qs.page,
      pageSize: qs.pageSize,
      q: qs.q,
    }));
    ticketsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => ticketsQuery?.data?.data || [], [ticketsQuery?.data?.data]);
  const loading = ticketsQuery?.isFetching || ticketsQuery?.isLoading;
  const page = ticketsQuery?.data?.page || ticketsParams.page || 1;
  const pageSize = ticketsQuery?.data?.pageSize || ticketsParams.pageSize || 20;
  const total = ticketsQuery?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setSearch = useCallback(
    (value) => {
      setTicketsParams((p) => ({ ...p, page: 1, q: value }));
      setQs({ q: value, page: 1 });
    },
    [setTicketsParams, setQs]
  );

  const setPage = useCallback(
    (value) => {
      setTicketsParams((p) => ({ ...p, page: value }));
      setQs({ page: value });
      ticketsQuery.refetch();
    },
    [setTicketsParams, setQs, ticketsQuery]
  );

  const setPageSize = useCallback(
    (value) => {
      setTicketsParams((p) => ({ ...p, page: 1, pageSize: value }));
      setQs({ pageSize: value, page: 1 });
    },
    [setTicketsParams, setQs]
  );

  const refetch = useCallback(() => ticketsQuery.refetch(), [ticketsQuery]);

  const value = useMemo(
    () => ({
      list,
      loading,
      page,
      pageSize,
      totalPages,
      search: ticketsParams.q || "",
      setSearch,
      setPage,
      setPageSize,
      refetch,
    }),
    [list, loading, page, pageSize, totalPages, ticketsParams.q, setSearch, setPage, setPageSize, refetch]
  );

  return (
    <AdminTicketsContext.Provider value={value}>
      {children}
    </AdminTicketsContext.Provider>
  );
}

export function useAdminTickets() {
  const ctx = useContext(AdminTicketsContext);
  if (!ctx) {
    throw new Error("useAdminTickets must be used within AdminTicketsProvider");
  }
  return ctx;
}
