"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { useAdmin } from "../context";

const AdminErrorsContext = createContext(undefined);

export function AdminErrorsProvider({ children }) {
  const { errorsQuery, errorsParams, setErrorsParams } = useAdmin();

  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      q: parseAsString.withDefault(""),
      from: parseAsString.withDefault(""),
      to: parseAsString.withDefault(""),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    setErrorsParams((p) => ({
      ...p,
      page: qs.page,
      pageSize: qs.pageSize,
      q: qs.q,
      from: qs.from,
      to: qs.to,
    }));
    errorsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => errorsQuery?.data?.data || [], [errorsQuery?.data?.data]);
  const loading = errorsQuery?.isFetching || errorsQuery?.isLoading;
  const page = errorsQuery?.data?.page || errorsParams.page || 1;
  const pageSize = errorsQuery?.data?.pageSize || errorsParams.pageSize || 20;
  const total = errorsQuery?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setDate = useCallback(
    (key, value) => {
      setErrorsParams((p) => ({ ...p, page: 1, [key]: value }));
      setQs({ [key]: value, page: 1 });
    },
    [setErrorsParams, setQs]
  );

  const setSearch = useCallback(
    (value) => {
      setErrorsParams((p) => ({ ...p, page: 1, q: value }));
      setQs({ q: value, page: 1 });
    },
    [setErrorsParams, setQs]
  );

  const setPage = useCallback(
    (value) => {
      setErrorsParams((p) => ({ ...p, page: value }));
      setQs({ page: value });
      errorsQuery.refetch();
    },
    [setErrorsParams, setQs, errorsQuery]
  );

  const setPageSize = useCallback(
    (value) => {
      setErrorsParams((p) => ({ ...p, page: 1, pageSize: value }));
      setQs({ pageSize: value, page: 1 });
    },
    [setErrorsParams, setQs]
  );

  const refetch = useCallback(() => errorsQuery.refetch(), [errorsQuery]);

  const value = useMemo(
    () => ({
      list,
      loading,
      page,
      pageSize,
      totalPages,
      params: errorsParams,
      search: errorsParams.q || "",
      setFrom: (v) => setDate("from", v),
      setTo: (v) => setDate("to", v),
      setSearch,
      setPage,
      setPageSize,
      refetch,
    }),
    [list, loading, page, pageSize, totalPages, errorsParams, setDate, setSearch, setPage, setPageSize, refetch]
  );

  return (
    <AdminErrorsContext.Provider value={value}>
      {children}
    </AdminErrorsContext.Provider>
  );
}

export function useAdminErrors() {
  const ctx = useContext(AdminErrorsContext);
  if (!ctx) {
    throw new Error("useAdminErrors must be used within AdminErrorsProvider");
  }
  return ctx;
}
