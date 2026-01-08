"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { useAdmin } from "../context";

const AdminMerchantsContext = createContext(undefined);

export function AdminMerchantsProvider({ children }) {
  const { merchantsQuery, merchantsParams, setMerchantsParams } = useAdmin();
  const [tab, setTabState] = useState("merchants");

  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      q: parseAsString.withDefault(""),
      tab: parseAsString.withDefault("merchants"),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    setTabState(qs.tab);
    setMerchantsParams((prev) => ({
      ...prev,
      page: qs.page,
      pageSize: qs.pageSize,
      q: qs.q,
    }));
    merchantsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const merchants = useMemo(
    () => merchantsQuery?.data?.merchants || [],
    [merchantsQuery?.data?.merchants]
  );
  const applicants = useMemo(
    () => merchantsQuery?.data?.applicants || [],
    [merchantsQuery?.data?.applicants]
  );
  const page = merchantsQuery?.data?.page || merchantsParams.page || 1;
  const pageSize =
    merchantsQuery?.data?.pageSize || merchantsParams.pageSize || 20;
  const merchantsTotal = merchantsQuery?.data?.merchantsTotal || 0;
  const applicantsTotal = merchantsQuery?.data?.applicantsTotal || 0;
  const total = tab === "merchants" ? merchantsTotal : applicantsTotal;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const loading = merchantsQuery?.isFetching || merchantsQuery?.isLoading;
  const error = merchantsQuery?.error?.message;
  const searchValue = merchantsParams.q || "";

  const refresh = useCallback(() => {
    merchantsQuery.refetch();
  }, [merchantsQuery]);

  const setSearch = useCallback(
    (value) => {
      setMerchantsParams((prev) => ({ ...prev, page: 1, q: value }));
      setQs({ q: value, page: 1 });
    },
    [setMerchantsParams, setQs]
  );

  const setPageSize = useCallback(
    (value) => {
      const next = Number(value) || 20;
      setMerchantsParams((prev) => ({ ...prev, page: 1, pageSize: next }));
      setQs({ pageSize: next, page: 1 });
    },
    [setMerchantsParams, setQs]
  );

  const toPage = useCallback(
    (p) => {
      const np = Math.min(Math.max(p, 1), totalPages);
      setMerchantsParams((prev) => ({ ...prev, page: np }));
      setQs({ page: np });
      merchantsQuery.refetch();
    },
    [merchantsQuery, setMerchantsParams, setQs, totalPages]
  );

  const setTab = useCallback(
    (value) => {
      setTabState(value);
      setQs({ tab: value });
    },
    [setQs]
  );

  const value = useMemo(
    () => ({
      tab,
      setTab,
      merchants,
      applicants,
      loading,
      error,
      page,
      pageSize,
      totalPages,
      searchValue,
      setSearch,
      setPageSize,
      toPage,
      refresh,
    }),
    [
      tab,
      setTab,
      merchants,
      applicants,
      loading,
      error,
      page,
      pageSize,
      totalPages,
      searchValue,
      setSearch,
      setPageSize,
      toPage,
      refresh,
    ]
  );

  return (
    <AdminMerchantsContext.Provider value={value}>
      {children}
    </AdminMerchantsContext.Provider>
  );
}

export function useAdminMerchants() {
  const ctx = useContext(AdminMerchantsContext);
  if (!ctx) {
    throw new Error("useAdminMerchants must be used within AdminMerchantsProvider");
  }
  return ctx;
}
