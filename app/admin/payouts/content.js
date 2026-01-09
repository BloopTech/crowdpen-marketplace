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
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payouts</CardTitle>
            <Button onClick={refreshPayouts} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="rounded-md border border-border p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="text-base font-semibold">Bulk Payouts</h3>
              <div className="text-xs text-muted-foreground">
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
                />
              </div>

              <div className="flex items-end gap-2">
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
                >
                  Prev
                </Button>
                <div className="text-xs text-muted-foreground">
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
                >
                  <option value="settle_all">Settle all outstanding</option>
                  <option value="cutoff">Settle up to cutoff date</option>
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
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetBulkBatch}
                  >
                    Reset batch
                  </Button>
                  <div className="text-xs text-muted-foreground">
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
                >
                  {bulkPreviewQuery.isFetching ? "Previewing…" : "Preview"}
                </Button>

                <Button
                  type="button"
                  onClick={runBulkCreate}
                  disabled={!bulkCanCreate || bulkCreating}
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
                >
                  Next batch
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Total preview:{" "}
                <span className="font-medium">
                  {fmt(bulkPreviewTotal, "USD")}
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
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
              <div className="mb-3 max-h-44 overflow-auto border border-border rounded p-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {users.map((u) => {
                    const checked = bulkSelectedIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-sm"
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
              <div className="text-sm text-red-500">
                {bulkPreviewQuery.error?.message || "Failed to preview"}
              </div>
            ) : bulkPreviewQuery.isSuccess && bulkPreviewRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No eligible merchants found.
              </div>
            ) : bulkPreviewRows.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkPreviewRows.map((r) => (
                      <TableRow key={r.merchantId}>
                        <TableCell>
                          {r.merchantName || r.merchantEmail || r.merchantId}
                        </TableCell>
                        <TableCell>{r.from}</TableCell>
                        <TableCell>{r.to}</TableCell>
                        <TableCell className="text-right">
                          {fmt(r.remaining, "USD")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {bulkCreateResult && (
              <div className="mt-3">
                <div className="text-sm">
                  Created {bulkCreateResult.created} of{" "}
                  {bulkCreateResult.attempted} payouts
                </div>
                <div className="mt-2 max-h-48 overflow-auto border border-border rounded p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(bulkCreateResult.results || []).map((r) => (
                        <TableRow
                          key={`${r.merchantId}-${r.from || ""}-${r.to || ""}`}
                          className={r.ok ? "" : "text-red-500"}
                        >
                          <TableCell>
                            {r.merchantName || r.merchantId}
                          </TableCell>
                          <TableCell>
                            {r.from && r.to ? `${r.from} → ${r.to}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.ok ? fmt(r.amount, "USD") : "-"}
                          </TableCell>
                          <TableCell>
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
          <div className="flex flex-wrap items-end gap-3 mb-4">
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
              />
            </div>

            <div className="min-w-[260px]">
              <div className="text-xs text-muted-foreground">
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
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button variant="outline" onClick={refreshPayouts}>
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
            >
              Export CSV
            </Button>
          </div>

          <div className="rounded-md border border-border p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="text-base font-semibold">
                Merchant earnings after platform fees
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => merchantPayoutsQuery.refetch()}
                disabled={merchantPayoutsQuery.isFetching}
              >
                {merchantPayoutsQuery.isFetching ? "Updating…" : "Refresh"}
              </Button>
            </div>
            {merchantPayoutsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading merchant payout data…
              </p>
            ) : merchantPayoutsQuery.error ? (
              <p className="text-sm text-red-500">
                {merchantPayoutsQuery.error?.message ||
                  "Failed to load merchant payouts"}
              </p>
            ) : eligibleMerchantPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible merchants found for the selected period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead className="text-right">Gross Sales</TableHead>
                      <TableHead className="text-right">
                        Coupon Discounts
                      </TableHead>
                      <TableHead className="text-right">
                        Crowdpen-Funded Discounts
                      </TableHead>
                      <TableHead className="text-right">
                        Merchant-Funded Discounts
                      </TableHead>
                      <TableHead className="text-right">
                        Crowdpen Share ({crowdpenFeeLabel})
                      </TableHead>
                      <TableHead className="text-right">
                        Startbutton Share ({startbuttonFeeLabel})
                      </TableHead>
                      <TableHead className="text-right">Net Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibleMerchantPayouts.map((merchant) => (
                      <TableRow key={merchant.merchantId}>
                        <TableCell>{merchant.merchantName}</TableCell>
                        <TableCell className="text-right">
                          {fmt(merchant.revenue, merchant.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(merchant.discountTotal, merchant.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(
                            merchant.discountCrowdpenFunded,
                            merchant.currency
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(
                            merchant.discountMerchantFunded,
                            merchant.currency
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(merchant.crowdpenFee, merchant.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(merchant.startbuttonFee, merchant.currency)}
                        </TableCell>
                        <TableCell className="text-right">
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
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Status</label>
              <select
                name="status"
                defaultValue="pending"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="pending">pending</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Reference</label>
              <input
                name="transaction_reference"
                placeholder="optional"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Note</label>
              <input
                name="note"
                placeholder="optional"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" disabled={!canCreatePayout}>
              Create Payout
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={tx?.User?.image}
                        color={tx?.User?.color}
                        className="h-8 w-8"
                      >
                        <AvatarFallback>
                          {(tx?.User?.name || tx?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {tx?.User?.name ||
                            tx?.User?.email ||
                            tx.recipient_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tx?.CreatedBy?.name || tx?.CreatedBy?.email || tx.created_by || "-"}
                  </TableCell>
                  <TableCell className="capitalize">{tx.created_via || "-"}</TableCell>
                  <TableCell>{fmt(Number(tx.amount || 0), tx.currency)}</TableCell>
                  <TableCell>{tx.currency}</TableCell>
                  <TableCell className="capitalize">{tx.status}</TableCell>
                  <TableCell>{tx.transaction_reference || "-"}</TableCell>
                  <TableCell>
                    {tx.createdAt
                      ? new Date(tx.createdAt).toLocaleString("en-US", {
                          timeZone: "UTC",
                        })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No payouts yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4">
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
