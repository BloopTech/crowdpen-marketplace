"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";

const AdminAnalyticsContext = createContext(null);

const CROWD_PEN_FEE_PERCENT = 0.15;
const STARTBUTTON_FEE_PERCENT = 0.05;
const PLATFORM_FEE_PERCENT = CROWD_PEN_FEE_PERCENT + STARTBUTTON_FEE_PERCENT;

async function fetchJson(url) {
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

export function AdminAnalyticsProvider({ children }) {
  const [qs, setQs] = useQueryStates(
    {
      from: parseAsString.withDefault(""),
      to: parseAsString.withDefault(""),
      interval: parseAsString.withDefault("day"),
      limit: parseAsInteger.withDefault(10),
    },
    { clearOnDefault: true }
  );

  const interval = ["day", "week", "month"].includes(qs.interval)
    ? qs.interval
    : "day";

  const fmtMoney = (v, currency) => {
    const cur = (currency || "").toString().trim().toUpperCase();
    const code = /^[A-Z]{3}$/.test(cur) ? cur : "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));
  };

  const fmtPeriod = (iso) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return String(iso || "");
    if (interval === "month") {
      return d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    if (interval === "week") {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        timeZone: "UTC",
      });
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    });
  };

  const revenueQuery = useQuery({
    queryKey: ["admin", "analytics", "revenue", qs],
    queryFn: () => {
      const sp = new URLSearchParams({ interval });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/revenue?${sp.toString()}`);
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["admin", "analytics", "summary", qs],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/summary?${sp.toString()}`);
    },
  });

  const paymentStatusQuery = useQuery({
    queryKey: ["admin", "analytics", "payment-status", qs],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/payment-status?${sp.toString()}`);
    },
  });

  const categoryBreakdownQuery = useQuery({
    queryKey: ["admin", "analytics", "category-breakdown", qs],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: String(qs.limit || 10) });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(
        `/api/admin/analytics/category-breakdown?${sp.toString()}`
      );
    },
  });

  const customersQuery = useQuery({
    queryKey: ["admin", "analytics", "customers", qs],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/customers?${sp.toString()}`);
    },
  });

  const paymentMethodQuery = useQuery({
    queryKey: ["admin", "analytics", "payment-method", qs],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/payment-method?${sp.toString()}`);
    },
  });

  const couponsQuery = useQuery({
    queryKey: ["admin", "analytics", "coupons", qs],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: String(qs.limit || 10) });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/coupons?${sp.toString()}`);
    },
  });

  const cohortsQuery = useQuery({
    queryKey: ["admin", "analytics", "cohorts", qs],
    queryFn: () => {
      const sp = new URLSearchParams({ cohort: "week", lookbackDays: "90" });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/cohorts?${sp.toString()}`);
    },
  });

  const inventoryRiskQuery = useQuery({
    queryKey: ["admin", "analytics", "inventory-risk", qs],
    queryFn: () => {
      const sp = new URLSearchParams({
        limit: "50",
        stockThreshold: "5",
        velocityWindowDays: "30",
      });
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/inventory-risk?${sp.toString()}`);
    },
  });

  const funnelQuery = useQuery({
    queryKey: ["admin", "analytics", "funnel", qs],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/funnel?${sp.toString()}`);
    },
  });

  const refundReasonsQuery = useQuery({
    queryKey: ["admin", "analytics", "refund-reasons", qs],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: String(qs.limit || 10) });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/refund-reasons?${sp.toString()}`);
    },
  });

  const timeToPayoutQuery = useQuery({
    queryKey: ["admin", "analytics", "time-to-payout", qs],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: String(qs.limit || 10) });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return fetchJson(`/api/admin/analytics/time-to-payout?${sp.toString()}`);
    },
  });

  const topProductsQuery = useQuery({
    queryKey: ["admin", "analytics", "top-products", qs],
    queryFn: async () => {
      const sp = new URLSearchParams({ limit: String(qs.limit || 10) });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return await fetchJson(
        `/api/admin/analytics/top-products?${sp.toString()}`
      );
    },
  });

  const topMerchantsQuery = useQuery({
    queryKey: ["admin", "analytics", "top-merchants", qs],
    queryFn: async () => {
      const sp = new URLSearchParams({ limit: String(qs.limit || 10) });
      if (qs.from) sp.set("from", qs.from);
      if (qs.to) sp.set("to", qs.to);
      return await fetchJson(
        `/api/admin/analytics/top-merchants?${sp.toString()}`
      );
    },
  });

  const loading =
    revenueQuery.isLoading ||
    summaryQuery.isLoading ||
    topProductsQuery.isLoading ||
    topMerchantsQuery.isLoading ||
    paymentStatusQuery.isLoading ||
    categoryBreakdownQuery.isLoading ||
    customersQuery.isLoading ||
    paymentMethodQuery.isLoading ||
    couponsQuery.isLoading ||
    cohortsQuery.isLoading ||
    inventoryRiskQuery.isLoading ||
    funnelQuery.isLoading ||
    refundReasonsQuery.isLoading ||
    timeToPayoutQuery.isLoading;

  const revenueData = revenueQuery?.data?.data || [];
  const revenueTotals = revenueQuery?.data?.totals || null;

  const summary = summaryQuery?.data?.data || null;
  const paymentStatusRows = paymentStatusQuery?.data?.data || [];
  const categoryRows = categoryBreakdownQuery?.data?.data || [];
  const customers = customersQuery?.data?.data || null;
  const paymentMethods = paymentMethodQuery?.data?.data || [];
  const couponRows = couponsQuery?.data?.data || [];
  const couponTotals = couponsQuery?.data?.totals || null;
  const cohortRows = cohortsQuery?.data?.data || [];
  const inventoryRiskRows = inventoryRiskQuery?.data?.data || [];

  const funnel = funnelQuery?.data?.data || null;
  const refundReasonRows = refundReasonsQuery?.data?.data || [];
  const timeToPayout = timeToPayoutQuery?.data?.data || null;

  const chartData = revenueData.map((r) => {
    const revenue = Number(r.revenue || 0) || 0;
    const crowdpenFee = revenue * CROWD_PEN_FEE_PERCENT;
    const startbuttonFee = revenue * STARTBUTTON_FEE_PERCENT;
    const creatorPayout = Math.max(0, revenue - crowdpenFee - startbuttonFee);
    return {
      period: r.period,
      revenue,
      crowdpenFee,
      startbuttonFee,
      creatorPayout,
    };
  });

  const chartConfig = {
    revenue: { label: "Gross Revenue", color: "hsl(var(--chart-1))" },
    crowdpenFee: { label: "Crowdpen Share", color: "hsl(var(--chart-2))" },
    startbuttonFee: { label: "Startbutton Share", color: "hsl(var(--chart-3))" },
    creatorPayout: { label: "Merchant Payout", color: "hsl(var(--chart-4))" },
  };

  const topProducts = topProductsQuery?.data?.data || [];
  const topMerchants = topMerchantsQuery?.data?.data || [];

  return (
    <AdminAnalyticsContext.Provider
      value={{
        loading,
        revenueTotals,
        topMerchants,
        topProducts,
        chartConfig,
        chartData,
        timeToPayout,
        refundReasonRows,
        funnel,
        inventoryRiskRows,
        cohortRows,
        summary,
        couponTotals,
        couponRows,
        paymentMethods,
        customers,
        categoryRows,
        paymentStatusRows,
        setQs,
        revenueQuery,
        topMerchantsQuery,
        topProductsQuery,
        summaryQuery,
        funnelQuery,
        cohortsQuery,
        couponsQuery,
        paymentStatusQuery,
        categoryBreakdownQuery,
        customersQuery,
        paymentMethodQuery,
        inventoryRiskQuery,
        timeToPayoutQuery,
        refundReasonsQuery,
        qs,
        fmtMoney,
        fmtPeriod,
        revenueData,
        platformFeePercent: PLATFORM_FEE_PERCENT,
        crowdpenFeePercent: CROWD_PEN_FEE_PERCENT,
        startbuttonFeePercent: STARTBUTTON_FEE_PERCENT,
        interval
      }}
    >
      {children}
    </AdminAnalyticsContext.Provider>
  );
}

export function useAdminAnalytics() {
  const ctx = useContext(AdminAnalyticsContext);
  if (!ctx)
    throw new Error(
      "useAdminAnalytics must be used within AdminAnalyticsProvider"
    );
  return ctx;
}
