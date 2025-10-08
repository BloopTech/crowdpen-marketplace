"use client";

import React, { createContext, useContext, useMemo } from "react";
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

  // Merchants
  const merchantsQuery = useQuery({
    queryKey: ["admin", "merchants"],
    queryFn: () => fetchJson("/api/admin/merchants"),
    enabled: false,
  });

  // KYC lists by status
  const kycPendingQuery = useQuery({
    queryKey: ["admin", "kyc", "pending"],
    queryFn: () => fetchJson("/api/admin/kyc?status=pending"),
    enabled: false,
  });
  const kycApprovedQuery = useQuery({
    queryKey: ["admin", "kyc", "approved"],
    queryFn: () => fetchJson("/api/admin/kyc?status=approved"),
    enabled: false,
  });
  const kycRejectedQuery = useQuery({
    queryKey: ["admin", "kyc", "rejected"],
    queryFn: () => fetchJson("/api/admin/kyc?status=rejected"),
    enabled: false,
  });

  // Payouts
  const payoutsQuery = useQuery({
    queryKey: ["admin", "payouts"],
    queryFn: () => fetchJson("/api/admin/payouts"),
    enabled: false,
  });

  // Transactions
  const transactionsQuery = useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: () => fetchJson("/api/admin/transactions"),
    enabled: false,
  });

  // Licenses (order items overview)
  const licensesQuery = useQuery({
    queryKey: ["admin", "licenses"],
    queryFn: () => fetchJson("/api/admin/licenses"),
    enabled: false,
  });

  // Users (for role management)
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchJson("/api/admin/users"),
  });

  // Tickets
  const ticketsQuery = useQuery({
    queryKey: ["admin", "tickets"],
    queryFn: () => fetchJson("/api/admin/tickets"),
    enabled: false,
  });

  const value = useMemo(() => ({
    dashboardQuery,
    merchantsQuery,
    kycPendingQuery,
    kycApprovedQuery,
    kycRejectedQuery,
    payoutsQuery,
    transactionsQuery,
    licensesQuery,
    usersQuery,
    ticketsQuery,
  }), [
    dashboardQuery,
    merchantsQuery,
    kycPendingQuery,
    kycApprovedQuery,
    kycRejectedQuery,
    payoutsQuery,
    transactionsQuery,
    licensesQuery,
    usersQuery,
    ticketsQuery,
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
