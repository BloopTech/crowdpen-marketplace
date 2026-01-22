"use client";

import React from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { PaginationSmart } from "../../components/ui/pagination";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { createPayout } from "./actions";
import { useAdminPayouts } from "./context";

export default function AdminPayoutsContent() {
  const {
    list,
    users,
    recipientSelectUsers,
    recipientsQuery,
    recipientQ,
    setRecipientQ,
    recipientPage,
    setRecipientPage,
    recipientTotalPages,
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
    bulkPayoutProvider,
    setBulkPayoutProvider,
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
    crowdpenFeeLabel,
    startbuttonFeeLabel,
    selectedRecipientId,
    setSelectedRecipientId,
    suggestedPayoutAmount,
    canSettle,
    canCreatePayout,
    eligibilityFrom,
    eligibilityMaxTo,
  } = useAdminPayouts();

  return (
    <div className="px-4 space-y-6" data-testid="admin-payouts-page">
      <Card data-testid="admin-payouts-card">
        <CardHeader data-testid="admin-payouts-header">
          <div className="flex items-center justify-between" data-testid="admin-payouts-title-row">
            <CardTitle data-testid="admin-payouts-title">Payouts</CardTitle>
            <Button
              onClick={refreshPayouts}
              disabled={loading}
              data-testid="admin-payouts-refresh"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div
            className="rounded-md border border-border p-4 mb-6"
            data-testid="admin-payouts-bulk-section"
          >
            <div
              className="flex items-center justify-between flex-wrap gap-2 mb-3"
              data-testid="admin-payouts-bulk-header"
            >
              <h3 className="text-base font-semibold" data-testid="admin-payouts-bulk-title">
                Bulk Payouts
              </h3>
              <div className="text-xs text-muted-foreground" data-testid="admin-payouts-bulk-description">
                Creates <span className="font-medium">pending</span> payouts
                (USD). Mark completed after sending money.
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div className="flex-1 min-w-64">
                <label className="block text-xs mb-1">Merchant search</label>
                <input
                  value={recipientQ}
                  onChange={(e) => {
                    setRecipientQ(e.target.value);
                    setRecipientPage(1);
                    resetBulkBatch();
                  }}
                  placeholder="Search merchants by name or email…"
                  className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="admin-payouts-bulk-search"
                />
              </div>

              <div className="flex items-end gap-2" data-testid="admin-payouts-bulk-pagination">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRecipientPage(Math.max(1, Number(recipientPage || 1) - 1));
                    resetBulkBatch();
                  }}
                  disabled={
                    (Number(recipientPage || 1) <= 1) ||
                    recipientsQuery.isFetching
                  }
                  data-testid="admin-payouts-bulk-prev"
                >
                  Prev
                </Button>
                <div className="text-xs text-muted-foreground" data-testid="admin-payouts-bulk-page">
                  Page <span className="font-medium">{recipientPage}</span> / {recipientTotalPages}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRecipientPage(
                      Math.min(
                        Number(recipientTotalPages || 1),
                        Number(recipientPage || 1) + 1
                      )
                    );
                    resetBulkBatch();
                  }}
                  disabled={
                    (Number(recipientPage || 1) >= Number(recipientTotalPages || 1)) ||
                    recipientsQuery.isFetching
                  }
                  data-testid="admin-payouts-bulk-next"
                >
                  Next
                </Button>
              </div>

              <div>
                <label className="block text-xs mb-1">Mode</label>
                <select
                  value={bulkMode}
                  onChange={(e) => {
                    setBulkMode(e.target.value);
                    resetBulkBatch();
                  }}
                  className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="admin-payouts-bulk-mode"
                >
                  <option value="settle_all">Settle all outstanding</option>
                  <option value="cutoff">Settle up to cutoff date</option>
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1">Payout provider</label>
                <select
                  value={bulkPayoutProvider}
                  onChange={(e) => setBulkPayoutProvider(e.target.value)}
                  className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="admin-payouts-bulk-provider"
                >
                  <option value="manual">manual</option>
                  <option value="paystack">paystack</option>
                  <option value="startbutton">startbutton</option>
                </select>
              </div>

              {bulkMode === "cutoff" && (
                <div>
                  <label className="block text-xs mb-1">Cutoff to</label>
                  <input
                    type="date"
                    value={bulkCutoffTo}
                    onChange={(e) => {
                      setBulkCutoffTo(e.target.value);
                      resetBulkBatch();
                    }}
                    max={todayIso}
                    className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="admin-payouts-bulk-cutoff"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs mb-1">Scope</label>
                <select
                  value={bulkScope}
                  onChange={(e) => {
                    setBulkScope(e.target.value);
                    resetBulkBatch();
                  }}
                  className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="admin-payouts-bulk-scope"
                >
                  <option value="all">All merchants</option>
                  <option value="selected">Selected merchants</option>
                </select>
              </div>

              {bulkScope === "selected" && (
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBulkSelectedIds(users.map((u) => u.id));
                      resetBulkBatch();
                    }}
                    disabled={users.length === 0}
                    data-testid="admin-payouts-bulk-select-page"
                  >
                    Select page
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBulkSelectedIds([]);
                      resetBulkBatch();
                    }}
                    data-testid="admin-payouts-bulk-clear"
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetBulkBatch}
                    data-testid="admin-payouts-bulk-reset"
                  >
                    Reset batch
                  </Button>
                  <div
                    className="text-xs text-muted-foreground"
                    data-testid="admin-payouts-bulk-selected-count"
                  >
                    {bulkSelectedIds.length} selected
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs mb-1">Batch size</label>
                <input
                  type="number"
                  value={bulkLimit}
                  min={1}
                  max={25}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBulkLimit(Number.isFinite(v) ? v : 10);
                    resetBulkBatch();
                  }}
                  className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="admin-payouts-bulk-limit"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetBulkBatch();
                    bulkPreviewQuery.refetch();
                  }}
                  disabled={!bulkCanPreview || bulkPreviewQuery.isFetching}
                  data-testid="admin-payouts-bulk-preview"
                >
                  {bulkPreviewQuery.isFetching ? "Previewing…" : "Preview"}
                </Button>

                <Button
                  type="button"
                  onClick={runBulkCreate}
                  disabled={!bulkCanCreate || bulkCreating}
                  data-testid="admin-payouts-bulk-create"
                >
                  {bulkCreating ? "Creating…" : "Create pending payouts"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (bulkNextCursor) setBulkCursor(bulkNextCursor);
                    bulkPreviewQuery.refetch();
                  }}
                  disabled={!bulkHasMore || bulkPreviewQuery.isFetching}
                  data-testid="admin-payouts-bulk-next-batch"
                >
                  Next batch
                </Button>
              </div>

              <div className="text-xs text-muted-foreground" data-testid="admin-payouts-bulk-total-preview">
                Total preview:{" "}
                <span className="font-medium">
                  {fmt(bulkPreviewTotal, "USD")}
                </span>
              </div>

              <div className="text-xs text-muted-foreground" data-testid="admin-payouts-bulk-batch-status">
                Batch:{" "}
                <span className="font-medium">
                  {bulkCursor ? "continuing" : "start"}
                </span>
                {bulkHasMore ? (
                  <span className="ml-2">More batches available</span>
                ) : null}
              </div>
            </div>

            {bulkScope === "selected" && users.length > 0 && (
              <div
                className="mb-3 max-h-44 overflow-auto border border-border rounded p-2"
                data-testid="admin-payouts-bulk-selected-list"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="admin-payouts-bulk-selected">
                  {users.map((u) => {
                    const checked = bulkSelectedIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-sm"
                        data-testid={`admin-payouts-bulk-select-${u.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setBulkSelectedIds((prev) => {
                              if (next)
                                return Array.from(new Set([...prev, u.id]));
                              return prev.filter((id) => id !== u.id);
                            });
                          }}
                          data-testid={`admin-payouts-bulk-checkbox-${u.id}`}
                        />
                        <span className="truncate">
                          {u.name || u.email || u.id}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {bulkPreviewQuery.error ? (
              <div className="text-sm text-red-500" data-testid="admin-payouts-bulk-preview-error">
                {bulkPreviewQuery.error?.message || "Failed to preview"}
              </div>
            ) : bulkPreviewQuery.isSuccess && bulkPreviewRows.length === 0 ? (
              <div className="text-sm text-muted-foreground" data-testid="admin-payouts-bulk-preview-empty">
                No eligible merchants found.
              </div>
            ) : bulkPreviewRows.length > 0 ? (
              <div className="overflow-x-auto" data-testid="admin-payouts-bulk-preview">
                <Table data-testid="admin-payouts-bulk-preview-table">
                  <TableHeader data-testid="admin-payouts-bulk-preview-head">
                    <TableRow data-testid="admin-payouts-bulk-preview-head-row">
                      <TableHead data-testid="admin-payouts-bulk-preview-head-merchant">
                        Merchant
                      </TableHead>
                      <TableHead data-testid="admin-payouts-bulk-preview-head-from">From</TableHead>
                      <TableHead data-testid="admin-payouts-bulk-preview-head-to">To</TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-payouts-bulk-preview-head-remaining"
                      >
                        Remaining
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody data-testid="admin-payouts-bulk-preview-body">
                    {bulkPreviewRows.map((r) => (
                      <TableRow key={r.merchantId} data-testid={`admin-payouts-bulk-preview-row-${r.merchantId}`}>
                        <TableCell data-testid={`admin-payouts-bulk-preview-row-${r.merchantId}-merchant`}>
                          {r.merchantName || r.merchantEmail || r.merchantId}
                        </TableCell>
                        <TableCell data-testid={`admin-payouts-bulk-preview-row-${r.merchantId}-from`}>
                          {r.from}
                        </TableCell>
                        <TableCell data-testid={`admin-payouts-bulk-preview-row-${r.merchantId}-to`}>
                          {r.to}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-bulk-preview-row-${r.merchantId}-remaining`}
                        >
                          {fmt(r.remaining, "USD")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {bulkCreateResult && (
              <div className="mt-3" data-testid="admin-payouts-bulk-results-section">
                <div className="text-sm" data-testid="admin-payouts-bulk-results-summary">
                  Created {bulkCreateResult.created} of{" "}
                  {bulkCreateResult.attempted} payouts
                </div>
                <div
                  className="mt-2 max-h-48 overflow-auto border border-border rounded p-2"
                  data-testid="admin-payouts-bulk-results"
                >
                  <Table data-testid="admin-payouts-bulk-results-table">
                    <TableHeader data-testid="admin-payouts-bulk-results-head">
                      <TableRow data-testid="admin-payouts-bulk-results-head-row">
                        <TableHead data-testid="admin-payouts-bulk-results-head-merchant">
                          Merchant
                        </TableHead>
                        <TableHead data-testid="admin-payouts-bulk-results-head-period">
                          Period
                        </TableHead>
                        <TableHead
                          className="text-right"
                          data-testid="admin-payouts-bulk-results-head-amount"
                        >
                          Amount
                        </TableHead>
                        <TableHead data-testid="admin-payouts-bulk-results-head-status">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody data-testid="admin-payouts-bulk-results-body">
                      {(bulkCreateResult.results || []).map((r) => (
                        <TableRow
                          key={`${r.merchantId}-${r.from || ""}-${r.to || ""}`}
                          className={r.ok ? "" : "text-red-500"}
                          data-testid={`admin-payouts-bulk-result-${r.merchantId}`}
                        >
                          <TableCell data-testid={`admin-payouts-bulk-result-${r.merchantId}-merchant`}>
                            {r.merchantName || r.merchantId}
                          </TableCell>
                          <TableCell data-testid={`admin-payouts-bulk-result-${r.merchantId}-period`}>
                            {r.from && r.to ? `${r.from} → ${r.to}` : "-"}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            data-testid={`admin-payouts-bulk-result-${r.merchantId}-amount`}
                          >
                            {r.ok ? fmt(r.amount, "USD") : "-"}
                          </TableCell>
                          <TableCell data-testid={`admin-payouts-bulk-result-${r.merchantId}-status`}>
                            {r.ok ? "created" : r.error || "failed"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4" data-testid="admin-payouts-filters">
            <div>
              <label className="block text-xs mb-1">From</label>
              <input
                type="date"
                value={payoutsParams.from || ""}
                onChange={(e) => setDateRange({ from: e.target.value })}
                min={eligibilityFrom || undefined}
                max={eligibilityFrom || undefined}
                disabled
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-from"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={payoutsParams.to || ""}
                onChange={(e) => setDateRange({ to: e.target.value })}
                min={payoutsParams.from || undefined}
                max={eligibilityMaxTo || undefined}
                disabled
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-to"
              />
            </div>

            <div className="min-w-[260px]" data-testid="admin-payouts-eligibility">
              <div className="text-xs text-muted-foreground" data-testid="admin-payouts-eligibility-status">
                {payoutEligibilityQuery.isLoading
                  ? "Checking merchant eligibility…"
                  : payoutEligibilityQuery.error
                    ? "Failed to check eligibility"
                    : payoutEligibilityQuery?.data?.data?.canSettle === true
                      ? `Next eligible period: ${eligibilityFrom} → ${eligibilityMaxTo}`
                      : payoutEligibilityQuery?.data?.data?.reason
                        ? payoutEligibilityQuery.data.data.reason
                        : "No eligible payout period"}
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-page-size"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={refreshPayouts}
              data-testid="admin-payouts-apply"
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const qs = new URLSearchParams();
                if (payoutsParams.from) qs.set("from", payoutsParams.from);
                if (payoutsParams.to) qs.set("to", payoutsParams.to);
                qs.set("format", "csv");
                window.open(`/api/admin/payouts?${qs.toString()}`, "_blank");
              }}
              data-testid="admin-payouts-export"
            >
              Export CSV
            </Button>
          </div>

          <div
            className="rounded-md border border-border p-4 mb-6"
            data-testid="admin-payouts-earnings-section"
          >
            <div
              className="flex items-center justify-between flex-wrap gap-2 mb-3"
              data-testid="admin-payouts-earnings-header"
            >
              <h3 className="text-base font-semibold" data-testid="admin-payouts-earnings-title">
                Merchant earnings after platform fees
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => merchantPayoutsQuery.refetch()}
                disabled={merchantPayoutsQuery.isFetching}
                data-testid="admin-payouts-earnings-refresh"
              >
                {merchantPayoutsQuery.isFetching ? "Updating…" : "Refresh"}
              </Button>
            </div>
            {merchantPayoutsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground" data-testid="admin-payouts-earnings-loading">
                Loading merchant payout data…
              </p>
            ) : merchantPayoutsQuery.error ? (
              <p className="text-sm text-red-500" data-testid="admin-payouts-earnings-error">
                {merchantPayoutsQuery.error?.message ||
                  "Failed to load merchant payouts"}
              </p>
            ) : eligibleMerchantPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="admin-payouts-earnings-empty">
                No eligible merchants found for the selected period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="admin-payouts-earnings-table">
                  <TableHeader data-testid="admin-payouts-earnings-head">
                    <TableRow data-testid="admin-payouts-earnings-head-row">
                      <TableHead data-testid="admin-payouts-earnings-head-merchant">Merchant</TableHead>
                      <TableHead className="text-right" data-testid="admin-payouts-earnings-head-gross">
                        Gross Sales
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-payouts-earnings-head-coupon"
                      >
                        Coupon Discounts
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-payouts-earnings-head-crowdpen-discount"
                      >
                        Crowdpen-Funded Discounts
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-payouts-earnings-head-merchant-discount"
                      >
                        Merchant-Funded Discounts
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-payouts-earnings-head-crowdpen-fee"
                      >
                        Crowdpen Share ({crowdpenFeeLabel})
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-payouts-earnings-head-startbutton-fee"
                      >
                        Startbutton Share ({startbuttonFeeLabel})
                      </TableHead>
                      <TableHead className="text-right" data-testid="admin-payouts-earnings-head-net">
                        Net Payout
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody data-testid="admin-payouts-earnings-body">
                    {eligibleMerchantPayouts.map((merchant) => (
                      <TableRow
                        key={merchant.merchantId}
                        data-testid={`admin-payouts-earnings-row-${merchant.merchantId}`}
                      >
                        <TableCell data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-merchant`}>
                          {merchant.merchantName}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-gross`}
                        >
                          {fmt(merchant.revenue, merchant.currency)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-coupon`}
                        >
                          {fmt(merchant.discountTotal, merchant.currency)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-crowdpen-discount`}
                        >
                          {fmt(
                            merchant.discountCrowdpenFunded,
                            merchant.currency
                          )}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-merchant-discount`}
                        >
                          {fmt(
                            merchant.discountMerchantFunded,
                            merchant.currency
                          )}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-crowdpen-fee`}
                        >
                          {fmt(merchant.crowdpenFee, merchant.currency)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-startbutton-fee`}
                        >
                          {fmt(merchant.startbuttonFee, merchant.currency)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          data-testid={`admin-payouts-earnings-row-${merchant.merchantId}-net`}
                        >
                          {fmt(merchant.creatorPayout, merchant.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <form
            action={createPayout}
            className="flex flex-wrap items-end gap-2 mb-4"
            data-testid="admin-payouts-create-form"
          >
            <input type="hidden" name="from" value={payoutsParams.from || ""} />
            <input type="hidden" name="to" value={payoutsParams.to || ""} />
            <div>
              <label className="block text-xs mb-1">Recipient</label>
              <select
                name="recipient_id"
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-48 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-recipient"
              >
                {recipientSelectUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Amount</label>
              <input
                name="amount"
                placeholder={canSettle ? "0" : "Select From/To"}
                value={
                  canSettle
                    ? payoutSummaryQuery.isFetching
                      ? ""
                      : String(suggestedPayoutAmount)
                    : ""
                }
                readOnly
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-amount"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => payoutSummaryQuery.refetch()}
                disabled={!canSettle || payoutSummaryQuery.isFetching}
                title={
                  !canSettle
                    ? "Select From/To and a recipient"
                    : payoutSummaryQuery.isFetching
                      ? "Calculating..."
                      : "Recalculate suggested payout"
                }
                data-testid="admin-payouts-recalculate"
              >
                {payoutSummaryQuery.isFetching ? "Calculating…" : "Recalculate"}
              </Button>
            </div>
            <div>
              <label className="block text-xs mb-1">Currency</label>
              <input
                name="currency"
                defaultValue="USD"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-currency"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Status</label>
              <select
                name="status"
                defaultValue="pending"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-status"
              >
                <option value="pending">pending</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Payout provider</label>
              <select
                name="payout_provider"
                defaultValue="manual"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-provider"
              >
                <option value="manual">manual</option>
                <option value="paystack">paystack</option>
                <option value="startbutton">startbutton</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Reference</label>
              <input
                name="transaction_reference"
                placeholder="optional"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-reference"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Note</label>
              <input
                name="note"
                placeholder="optional"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-payouts-note"
              />
            </div>
            <Button
              type="submit"
              disabled={!canCreatePayout}
              data-testid="admin-payouts-submit"
            >
              Create Payout
            </Button>
          </form>

          <Table data-testid="admin-payouts-list-table">
            <TableHeader data-testid="admin-payouts-list-head">
              <TableRow data-testid="admin-payouts-list-head-row">
                <TableHead data-testid="admin-payouts-list-head-recipient">Recipient</TableHead>
                <TableHead data-testid="admin-payouts-list-head-created-by">Created By</TableHead>
                <TableHead data-testid="admin-payouts-list-head-source">Source</TableHead>
                <TableHead data-testid="admin-payouts-list-head-amount">Amount</TableHead>
                <TableHead data-testid="admin-payouts-list-head-currency">Currency</TableHead>
                <TableHead data-testid="admin-payouts-list-head-status">Status</TableHead>
                <TableHead data-testid="admin-payouts-list-head-reference">Reference</TableHead>
                <TableHead data-testid="admin-payouts-list-head-date">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="admin-payouts-list-body">
              {list.map((tx) => (
                <TableRow key={tx.id} data-testid={`admin-payout-row-${tx.id}`}>
                  <TableCell data-testid={`admin-payout-row-${tx.id}-recipient`}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={tx?.User?.image}
                        color={tx?.User?.color}
                        className="h-8 w-8"
                        data-testid={`admin-payout-row-${tx.id}-avatar`}
                      >
                        <AvatarFallback>
                          {(tx?.User?.name || tx?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className="font-medium"
                          data-testid={`admin-payout-row-${tx.id}-recipient-name`}
                        >
                          {tx?.User?.name ||
                            tx?.User?.email ||
                            tx.recipient_id}
                        </div>
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid={`admin-payout-row-${tx.id}-recipient-email`}
                        >
                          {tx?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`admin-payout-row-${tx.id}-created-by`}>
                    {tx?.CreatedBy?.name || tx?.CreatedBy?.email || tx.created_by || "-"}
                  </TableCell>
                  <TableCell
                    className="capitalize"
                    data-testid={`admin-payout-row-${tx.id}-source`}
                  >
                    {tx.created_via || "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-payout-row-${tx.id}-amount`}>
                    {fmt(Number(tx.amount || 0), tx.currency)}
                  </TableCell>
                  <TableCell data-testid={`admin-payout-row-${tx.id}-currency`}>
                    {tx.currency}
                  </TableCell>
                  <TableCell
                    className="capitalize"
                    data-testid={`admin-payout-row-${tx.id}-status`}
                  >
                    {tx.status}
                  </TableCell>
                  <TableCell data-testid={`admin-payout-row-${tx.id}-reference`}>
                    {tx.transaction_reference || "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-payout-row-${tx.id}-date`}>
                    {tx.createdAt
                      ? new Date(tx.createdAt).toLocaleString("en-US", {
                          timeZone: "UTC",
                        })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow data-testid="admin-payouts-empty">
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                    data-testid="admin-payouts-empty-cell"
                  >
                    No payouts yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4" data-testid="admin-payouts-pagination">
            <PaginationSmart
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(np) => setPage(np)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
