"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const AdminPaymentProviderContext = createContext(null);

function fetchJson(url, opts) {
  return fetch(url, { credentials: "include", cache: "no-store", ...(opts || {}) }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      const message = data?.message || `Failed to fetch ${url}`;
      throw new Error(message);
    }
    return data;
  });
}

export function AdminPaymentProviderProvider({ children }) {
  const queryClient = useQueryClient();

  const providerQuery = useQuery({
    queryKey: ["admin", "payment-provider"],
    queryFn: () => fetchJson("/api/admin/payment-provider"),
  });

  const updateMutation = useMutation({
    mutationFn: async (activeProvider) => {
      return fetchJson("/api/admin/payment-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider }),
      });
    },
    onSuccess: () => {
      toast.success("Payment provider updated");
      queryClient.invalidateQueries(["admin", "payment-provider"]);
      queryClient.invalidateQueries(["marketplace", "payment-provider"]);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update payment provider");
    },
  });

  const activeProvider = useMemo(() => {
    const v = providerQuery?.data?.data?.activeProvider;
    return typeof v === "string" ? v : "startbutton";
  }, [providerQuery?.data?.data?.activeProvider]);

  const value = useMemo(
    () => ({
      providerQuery,
      activeProvider,
      updateMutation,
    }),
    [providerQuery, activeProvider, updateMutation]
  );

  return (
    <AdminPaymentProviderContext.Provider value={value}>
      {children}
    </AdminPaymentProviderContext.Provider>
  );
}

export function useAdminPaymentProvider() {
  const ctx = useContext(AdminPaymentProviderContext);
  if (!ctx) {
    throw new Error(
      "useAdminPaymentProvider must be used inside AdminPaymentProviderProvider"
    );
  }
  return ctx;
}
