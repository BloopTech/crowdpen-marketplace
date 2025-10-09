"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const AdminContext = createContext(undefined);

function fetchJson(url) {
  return fetch(url, { credentials: "include", cache: "no-store" }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      const message = data?.message || `Failed to fetch ${url}`;
      throw new Error(message);
    }
    return data;
  });
}

export function AdminProvider({ children }) {
  // Dashboard
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => fetchJson("/api/admin/dashboard"),
  });

  // Merchants (with pagination)
  const [merchantsParams, setMerchantsParams] = useState({ page: 1, pageSize: 20, q: "" });
  const merchantsQuery = useQuery({
    queryKey: ["admin", "merchants", merchantsParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(merchantsParams.page || 1),
        pageSize: String(merchantsParams.pageSize || 20),
        q: merchantsParams.q || "",
      });
      return fetchJson(`/api/admin/merchants?${qs.toString()}`);
    },
    enabled: false,
  });

  // KYC lists by status
  const [kycPendingParams, setKycPendingParams] = useState({ page: 1, pageSize: 20, level: "", reviewer: "" });
  const [kycApprovedParams, setKycApprovedParams] = useState({ page: 1, pageSize: 20, level: "", reviewer: "" });
  const [kycRejectedParams, setKycRejectedParams] = useState({ page: 1, pageSize: 20, level: "", reviewer: "" });
  const {
    data: kycPendingQueryData,
    isLoading: kycPendingQueryLoading,
    refetch: kycPendingQueryRefetch,
  } = useQuery({
    queryKey: ["admin", "kyc", "pending", kycPendingParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        status: "pending",
        page: String(kycPendingParams.page || 1),
        pageSize: String(kycPendingParams.pageSize || 20),
      });
      if (kycPendingParams.level) qs.set("level", kycPendingParams.level);
      if (kycPendingParams.reviewer) qs.set("reviewer", kycPendingParams.reviewer);
      return fetchJson(`/api/admin/kyc?${qs.toString()}`);
    },
    enabled: false,
  });
  const {
    data: kycApprovedQueryData,
    isLoading: kycApprovedQueryLoading,
    refetch: kycApprovedQueryRefetch
  } = useQuery({
    queryKey: ["admin", "kyc", "approved", kycApprovedParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        status: "approved",
        page: String(kycApprovedParams.page || 1),
        pageSize: String(kycApprovedParams.pageSize || 20),
      });
      if (kycApprovedParams.level) qs.set("level", kycApprovedParams.level);
      if (kycApprovedParams.reviewer) qs.set("reviewer", kycApprovedParams.reviewer);
      return fetchJson(`/api/admin/kyc?${qs.toString()}`);
    },
    enabled: false,
  });
  const {
    data: kycRejectedQueryData,
    isLoading: kycRejectedQueryLoading,
    refetch: kycRejectedQueryRefetch
  } = useQuery({
    queryKey: ["admin", "kyc", "rejected", kycRejectedParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        status: "rejected",
        page: String(kycRejectedParams.page || 1),
        pageSize: String(kycRejectedParams.pageSize || 20),
      });
      if (kycRejectedParams.level) qs.set("level", kycRejectedParams.level);
      if (kycRejectedParams.reviewer) qs.set("reviewer", kycRejectedParams.reviewer);
      return fetchJson(`/api/admin/kyc?${qs.toString()}`);
    },
    enabled: false,
  });

  // Payouts
  const [payoutsParams, setPayoutsParams] = useState({ page: 1, pageSize: 20, from: "", to: "" });
  const payoutsQuery = useQuery({
    queryKey: ["admin", "payouts", payoutsParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(payoutsParams.page || 1),
        pageSize: String(payoutsParams.pageSize || 20),
      });
      if (payoutsParams.from) qs.set("from", payoutsParams.from);
      if (payoutsParams.to) qs.set("to", payoutsParams.to);
      return fetchJson(`/api/admin/payouts?${qs.toString()}`);
    },
    enabled: false,
  });

  // Transactions
  const [transactionsParams, setTransactionsParams] = useState({ page: 1, pageSize: 20, from: "", to: "" });
  const transactionsQuery = useQuery({
    queryKey: ["admin", "transactions", transactionsParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(transactionsParams.page || 1),
        pageSize: String(transactionsParams.pageSize || 20),
      });
      if (transactionsParams.from) qs.set("from", transactionsParams.from);
      if (transactionsParams.to) qs.set("to", transactionsParams.to);
      return fetchJson(`/api/admin/transactions?${qs.toString()}`);
    },
    enabled: false,
  });

  // Licenses (order items overview)
  const [licensesParams, setLicensesParams] = useState({ page: 1, pageSize: 20 });
  const licensesQuery = useQuery({
    queryKey: ["admin", "licenses", licensesParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(licensesParams.page || 1),
        pageSize: String(licensesParams.pageSize || 20),
      });
      return fetchJson(`/api/admin/licenses?${qs.toString()}`);
    },
    enabled: false,
  });

  // Users (for role management)
  const usersQuery = useQuery({
    queryKey: ["admin", "users", { scope: "privileged" }],
    queryFn: () => fetchJson(`/api/admin/users?scope=privileged&limit=200`),
  });

  // Tickets
  const [ticketsParams, setTicketsParams] = useState({ page: 1, pageSize: 20, q: "" });
  const ticketsQuery = useQuery({
    queryKey: ["admin", "tickets", ticketsParams],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(ticketsParams.page || 1),
        pageSize: String(ticketsParams.pageSize || 20),
      });
      if (ticketsParams.q) qs.set("q", ticketsParams.q);
      return fetchJson(`/api/admin/tickets?${qs.toString()}`);
    },
    enabled: false,
  });

  const value = useMemo(() => ({
    dashboardQuery,
    merchantsQuery,
    merchantsParams,
    setMerchantsParams,
    kycPendingQueryData,
    kycPendingQueryLoading,
    kycPendingQueryRefetch,
    kycApprovedQueryData,
    kycApprovedQueryRefetch,
    kycApprovedQueryLoading,
    kycRejectedQueryData,
    kycRejectedQueryLoading,
    kycRejectedQueryRefetch,
    kycPendingParams,
    kycApprovedParams,
    kycRejectedParams,
    setKycPendingParams,
    setKycApprovedParams,
    setKycRejectedParams,
    payoutsQuery,
    payoutsParams,
    setPayoutsParams,
    transactionsQuery,
    transactionsParams,
    setTransactionsParams,
    licensesQuery,
    licensesParams,
    setLicensesParams,
    usersQuery,
    ticketsQuery,
    ticketsParams,
    setTicketsParams,
  }), [
    dashboardQuery,
    merchantsQuery,
    merchantsParams,
    kycPendingQueryData,
    kycPendingQueryLoading,
    kycPendingQueryRefetch,
    kycApprovedQueryData,
    kycApprovedQueryRefetch,
    kycApprovedQueryLoading,
    kycRejectedQueryData,
    kycRejectedQueryLoading,
    kycRejectedQueryRefetch,
    kycPendingParams,
    kycApprovedParams,
    kycRejectedParams,
    payoutsQuery,
    payoutsParams,
    transactionsQuery,
    transactionsParams,
    licensesQuery,
    licensesParams,
    usersQuery,
    ticketsQuery,
    ticketsParams,
  ]);

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
