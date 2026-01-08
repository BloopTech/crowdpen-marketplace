"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { useAdmin } from "../context";

const AdminPayoutsContext = createContext(undefined);

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

function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      const message = data?.message || `Failed to post ${url}`;
      throw new Error(message);
    }
    return data;
  });
}

export function AdminPayoutsProvider({ children }) {
  const {
    payoutsQuery,
    merchantRecipientsQuery,
    payoutsParams,
    setPayoutsParams,
  } = useAdmin();
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [bulkMode, setBulkMode] = useState("settle_all");
  const [bulkCutoffTo, setBulkCutoffTo] = useState("");
  const [bulkScope, setBulkScope] = useState("all");
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkCreateResult, setBulkCreateResult] = useState(null);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkCursor, setBulkCursor] = useState("");
  const [bulkLimit, setBulkLimit] = useState(10);

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
    setPayoutsParams((p) => ({
      ...p,
      page: qs.page,
      pageSize: qs.pageSize,
      from: qs.from,
      to: qs.to,
    }));
    payoutsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(
    () => payoutsQuery?.data?.data || [],
    [payoutsQuery?.data?.data]
  );
  const recipientsData = merchantRecipientsQuery?.data?.data;
  const users = useMemo(() => {
    const arr = Array.isArray(recipientsData) ? recipientsData : [];
    return arr.filter((u) => u?.merchant === true);
  }, [recipientsData]);

  useEffect(() => {
    if (!selectedRecipientId && users.length > 0) {
      setSelectedRecipientId(users[0].id);
    }
  }, [selectedRecipientId, users]);

  const loading = payoutsQuery?.isFetching || payoutsQuery?.isLoading;
  const page = payoutsQuery?.data?.page || payoutsParams.page || 1;
  const pageSize = payoutsQuery?.data?.pageSize || payoutsParams.pageSize || 20;
  const total = payoutsQuery?.data?.total || 0;
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

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const payoutEligibilityQuery = useQuery({
    queryKey: ["admin", "payouts", "eligibility", selectedRecipientId || ""],
    enabled: Boolean(selectedRecipientId),
    queryFn: () => {
      const sp = new URLSearchParams({ recipientId: selectedRecipientId });
      return fetchJson(`/api/admin/payouts/eligibility?${sp.toString()}`);
    },
  });

  const bulkPreviewQuery = useQuery({
    queryKey: [
      "admin",
      "payouts",
      "bulk",
      "preview",
      bulkMode,
      bulkCutoffTo,
      bulkScope,
      bulkSelectedIds,
      bulkCursor,
      bulkLimit,
    ],
    enabled: false,
    queryFn: () => {
      const sp = new URLSearchParams({ mode: bulkMode });
      if (bulkMode === "cutoff") sp.set("cutoffTo", bulkCutoffTo);
      if (bulkScope === "selected" && bulkSelectedIds.length) {
        sp.set("merchantIds", bulkSelectedIds.join(","));
      }
      if (bulkCursor) sp.set("cursor", bulkCursor);
      sp.set("limit", String(bulkLimit || 10));
      return fetchJson(`/api/admin/payouts/bulk/preview?${sp.toString()}`);
    },
  });

  useEffect(() => {
    const d = payoutEligibilityQuery?.data?.data;
    if (!d || d?.canSettle !== true) return;
    const eligibleFrom = d.eligibleFrom || "";
    const maxTo = d.maxTo || "";
    if (!eligibleFrom || !maxTo) return;

    setPayoutsParams((p) => {
      const next = { ...p };
      if (next.from !== eligibleFrom) next.from = eligibleFrom;
      if (next.to !== maxTo) next.to = maxTo;
      return next;
    });
    setQs({ from: eligibleFrom, to: maxTo, page: 1 });
  }, [payoutEligibilityQuery?.data?.data, setPayoutsParams, setQs]);

  const merchantPayoutsQuery = useQuery({
    queryKey: [
      "admin",
      "analytics",
      "merchant-payouts",
      payoutsParams.from || "",
      payoutsParams.to || "",
    ],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "100" });
      if (payoutsParams.from) qs.set("from", payoutsParams.from);
      if (payoutsParams.to) qs.set("to", payoutsParams.to);
      return fetchJson(`/api/admin/analytics/top-merchants?${qs.toString()}`);
    },
  });

  const eligibleMerchantPayouts = useMemo(() => {
    if (!users.length || !Array.isArray(merchantPayoutsQuery?.data?.data)) {
      return [];
    }
    const eligibleIds = new Set(users.map((u) => u.id));
    return merchantPayoutsQuery.data.data
      .filter((row) => eligibleIds.has(row.merchantId || row.id))
      .map((row) => {
        const revenue = Number(row.revenue || 0);
        const crowdpenFee = Number(row.crowdpenFee || 0);
        const startbuttonFee = Number(row.startbuttonFee || 0);
        const creatorPayout =
          row.creatorPayout != null
            ? Number(row.creatorPayout)
            : Math.max(0, revenue - crowdpenFee - startbuttonFee);
        const merchantId = row.merchantId || row.id;
        const matchedUser = users.find((u) => u.id === merchantId);
        const discountTotal = Number(row.discountTotal || 0);
        const discountCrowdpenFunded = Number(
          row.discountCrowdpenFunded || 0
        );
        return {
          merchantId,
          merchantName:
            matchedUser?.name ||
            matchedUser?.email ||
            row.merchantPenName ||
            row.merchantName ||
            "Unknown merchant",
          revenue,
          crowdpenFee,
          startbuttonFee,
          creatorPayout,
          discountTotal,
          discountCrowdpenFunded,
          currency: row.currency || "USD",
        };
      });
  }, [merchantPayoutsQuery?.data?.data, users]);

  const payoutSummaryQuery = useQuery({
    queryKey: [
      "admin",
      "payouts",
      "summary",
      selectedRecipientId || "",
      payoutsParams.from || "",
      payoutsParams.to || "",
    ],
    enabled: Boolean(
      selectedRecipientId && payoutsParams.from && payoutsParams.to
    ),
    queryFn: () => {
      const sp = new URLSearchParams({ recipientId: selectedRecipientId });
      sp.set("from", payoutsParams.from);
      sp.set("to", payoutsParams.to);
      return fetchJson(`/api/admin/payouts/summary?${sp.toString()}`);
    },
  });

  const selectedMerchantPayoutRow = useMemo(() => {
    if (!selectedRecipientId) return null;
    return (
      eligibleMerchantPayouts.find(
        (m) => m.merchantId === selectedRecipientId
      ) || null
    );
  }, [eligibleMerchantPayouts, selectedRecipientId]);

  const suggestedPayoutAmount = useMemo(() => {
    const grossNetPayout =
      Number(selectedMerchantPayoutRow?.creatorPayout || 0) || 0;
    const completed =
      Number(payoutSummaryQuery?.data?.data?.payouts?.completed || 0) || 0;
    const pending =
      Number(payoutSummaryQuery?.data?.data?.payouts?.pending || 0) || 0;
    const payoutsTotal = completed + pending;
    const remaining = grossNetPayout - payoutsTotal;
    if (!Number.isFinite(remaining)) return 0;
    return Math.max(0, Number(remaining.toFixed(2)));
  }, [
    selectedMerchantPayoutRow,
    payoutSummaryQuery?.data?.data?.payouts?.completed,
    payoutSummaryQuery?.data?.data?.payouts?.pending,
  ]);

  const canSettle =
    Boolean(selectedRecipientId) &&
    payoutEligibilityQuery?.data?.data?.canSettle === true &&
    Boolean(payoutsParams.from && payoutsParams.to);
  const canCreatePayout =
    canSettle &&
    payoutSummaryQuery.isSuccess &&
    !payoutSummaryQuery.isFetching &&
    suggestedPayoutAmount > 0;

  const eligibilityMaxTo = payoutEligibilityQuery?.data?.data?.maxTo || "";
  const eligibilityFrom = payoutEligibilityQuery?.data?.data?.eligibleFrom || "";

  const bulkPreviewRows = useMemo(
    () => bulkPreviewQuery?.data?.data?.rows || [],
    [bulkPreviewQuery?.data?.data?.rows]
  );
  const bulkHasMore = bulkPreviewQuery?.data?.data?.hasMore === true;
  const bulkNextCursor = bulkPreviewQuery?.data?.data?.nextCursor || "";
  const bulkPreviewTotal = useMemo(() => {
    const sum = (bulkPreviewRows || []).reduce(
      (acc, r) => acc + (Number(r?.remaining || 0) || 0),
      0
    );
    return Number.isFinite(sum) ? Number(sum.toFixed(2)) : 0;
  }, [bulkPreviewRows]);

  const bulkCanPreview =
    bulkMode === "settle_all" || (bulkMode === "cutoff" && Boolean(bulkCutoffTo));
  const bulkCanCreate =
    bulkCanPreview &&
    bulkPreviewQuery.isSuccess &&
    !bulkPreviewQuery.isFetching &&
    Array.isArray(bulkPreviewRows) &&
    bulkPreviewRows.length > 0;

  const runBulkCreate = useCallback(async () => {
    setBulkCreateResult(null);
    setBulkCreating(true);
    try {
      const payload = {
        mode: bulkMode,
        cutoffTo: bulkMode === "cutoff" ? bulkCutoffTo : undefined,
        merchantIds: bulkScope === "selected" ? bulkSelectedIds : [],
        cursor: bulkCursor || undefined,
        limit: bulkLimit || 10,
      };
      const data = await postJson("/api/admin/payouts/bulk/create", payload);
      setBulkCreateResult(data?.data || null);
      if (data?.data?.nextCursor) {
        setBulkCursor(String(data.data.nextCursor));
      }
      payoutsQuery.refetch();
    } finally {
      setBulkCreating(false);
    }
  }, [
    bulkMode,
    bulkCutoffTo,
    bulkScope,
    bulkSelectedIds,
    bulkCursor,
    bulkLimit,
    payoutsQuery,
  ]);

  const resetBulkBatch = useCallback(() => {
    setBulkCursor("");
    setBulkCreateResult(null);
  }, []);

  const clearBulkResult = useCallback(() => {
    setBulkCreateResult(null);
  }, []);

  const setPage = useCallback(
    (np) => {
      setPayoutsParams((p) => ({ ...p, page: np }));
      setQs({ page: np });
      payoutsQuery.refetch();
    },
    [setPayoutsParams, setQs, payoutsQuery]
  );

  const setPageSize = useCallback(
    (size) => {
      setPayoutsParams((p) => ({ ...p, page: 1, pageSize: size }));
      setQs({ pageSize: size, page: 1 });
    },
    [setPayoutsParams, setQs]
  );

  const setDateRange = useCallback(
    ({ from, to }) => {
      setPayoutsParams((p) => ({
        ...p,
        page: 1,
        from: from ?? p.from,
        to: to ?? p.to,
      }));
      setQs((prev) => ({
        from: from ?? prev.from,
        to: to ?? prev.to,
        page: 1,
      }));
    },
    [setPayoutsParams, setQs]
  );

  const refreshPayouts = useCallback(() => {
    payoutsQuery.refetch();
  }, [payoutsQuery]);

  const value = useMemo(
    () => ({
      list,
      users,
      loading,
      page,
      pageSize,
      totalPages,
      fmt,
      payoutsParams,
      setPage,
      setPageSize,
      setDateRange,
      refreshPayouts,
      todayIso,
      bulkMode,
      setBulkMode,
      bulkCutoffTo,
      setBulkCutoffTo,
      bulkScope,
      setBulkScope,
      bulkSelectedIds,
      setBulkSelectedIds,
      bulkCreateResult,
      bulkCreating,
      bulkCursor,
      setBulkCursor,
      bulkLimit,
      setBulkLimit,
      bulkPreviewQuery,
      bulkPreviewRows,
      bulkHasMore,
      bulkNextCursor,
      bulkPreviewTotal,
      bulkCanPreview,
      bulkCanCreate,
      runBulkCreate,
      resetBulkBatch,
      clearBulkResult,
      payoutEligibilityQuery,
      merchantPayoutsQuery,
      eligibleMerchantPayouts,
      payoutSummaryQuery,
      selectedRecipientId,
      setSelectedRecipientId,
      suggestedPayoutAmount,
      canSettle,
      canCreatePayout,
      eligibilityFrom,
      eligibilityMaxTo,
    }),
    [
      list,
      users,
      loading,
      page,
      pageSize,
      totalPages,
      fmt,
      payoutsParams,
      setPage,
      setPageSize,
      setDateRange,
      refreshPayouts,
      todayIso,
      bulkMode,
      setBulkMode,
      bulkCutoffTo,
      setBulkCutoffTo,
      bulkScope,
      setBulkScope,
      bulkSelectedIds,
      setBulkSelectedIds,
      bulkCreateResult,
      bulkCreating,
      bulkCursor,
      setBulkCursor,
      bulkLimit,
      setBulkLimit,
      bulkPreviewQuery,
      bulkPreviewRows,
      bulkHasMore,
      bulkNextCursor,
      bulkPreviewTotal,
      bulkCanPreview,
      bulkCanCreate,
      runBulkCreate,
      resetBulkBatch,
      payoutEligibilityQuery,
      merchantPayoutsQuery,
      eligibleMerchantPayouts,
      payoutSummaryQuery,
      selectedRecipientId,
      setSelectedRecipientId,
      suggestedPayoutAmount,
      canSettle,
      canCreatePayout,
      eligibilityFrom,
      eligibilityMaxTo,
      clearBulkResult,
    ]
  );

  return (
    <AdminPayoutsContext.Provider value={value}>
      {children}
    </AdminPayoutsContext.Provider>
  );
}

export function useAdminPayouts() {
  const ctx = useContext(AdminPayoutsContext);
  if (!ctx) {
    throw new Error("useAdminPayouts must be used within AdminPayoutsProvider");
  }
  return ctx;
}
