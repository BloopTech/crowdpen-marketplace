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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { PaginationSmart } from "../../components/ui/pagination";
import { Badge } from "../../components/ui/badge";
import Link from "next/link";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { toggleMerchant } from "./actions";
import { useAdminMerchants } from "./context";

export default function AdminMerchantsContent() {
  const {
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
  } = useAdminMerchants();

  const fmtUsd = (v) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));
  };

  const fmtDateTimeUtc = (v) => {
    const d = v ? new Date(v) : null;
    if (!d || !Number.isFinite(d.getTime())) return "-";
    return d.toLocaleString("en-US", { timeZone: "UTC" });
  };

  return (
    <div className="px-4 space-y-6" data-testid="admin-merchants-page">
      <Card data-testid="admin-merchants-card">
        <CardHeader data-testid="admin-merchants-header">
          <div className="flex items-center justify-between" data-testid="admin-merchants-title-row">
            <CardTitle data-testid="admin-merchants-title">Merchants & Applicants</CardTitle>
            <Button
              onClick={refresh}
              disabled={loading}
              data-testid="admin-merchants-refresh"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4" data-testid="admin-merchants-filters">
            <div>
              <label className="block text-xs mb-1">Search</label>
              <input
                type="text"
                placeholder="Name or email"
                value={searchValue}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-merchants-search"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-merchants-page-size"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={refresh}
              data-testid="admin-merchants-apply"
            >
              Apply
            </Button>
          </div>
          {error ? (
            <div className="text-destructive text-sm" data-testid="admin-merchants-error">{error}</div>
          ) : null}
          <Tabs value={tab} onValueChange={setTab} data-testid="admin-merchants-tabs">
            <TabsList data-testid="admin-merchants-tabs-list">
              <TabsTrigger value="merchants" data-testid="admin-merchants-tab-merchants">
                Merchants
              </TabsTrigger>
              <TabsTrigger value="applicants" data-testid="admin-merchants-tab-applicants">
                Applicants
              </TabsTrigger>
            </TabsList>

            <TabsContent value="merchants" data-testid="admin-merchants-tab-content">
              <Table stickyFirstColumn data-testid="admin-merchants-table">
                <TableHeader data-testid="admin-merchants-head">
                  <TableRow data-testid="admin-merchants-head-row">
                    <TableHead data-testid="admin-merchants-head-name">Name</TableHead>
                    <TableHead data-testid="admin-merchants-head-kyc">KYC</TableHead>
                    <TableHead className="text-right" data-testid="admin-merchants-head-products">
                      Products
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-merchants-head-flagged">
                      Flagged
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-merchants-head-stock-risk">
                      Stock Risk
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-merchants-head-buyer-paid">
                      Buyer Paid (30d)
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-merchants-head-units">
                      Units (30d)
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-merchants-head-payouts">
                      Payouts (Owed)
                    </TableHead>
                    <TableHead data-testid="admin-merchants-head-last-paid">Last Paid</TableHead>
                    <TableHead data-testid="admin-merchants-head-settled">Last Settled To</TableHead>
                    <TableHead data-testid="admin-merchants-head-status">Status</TableHead>
                    <TableHead data-testid="admin-merchants-head-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-merchants-body">
                  {merchants.map((u) => {
                    const kpi = u?.kpi;
                    const kycLabel = kpi?.kycStatus
                      ? `${kpi.kycStatus}${kpi.kycLevel ? ` (${kpi.kycLevel})` : ""}`
                      : "unverified";
                    const kycVariant =
                      kpi?.kycStatus === "approved"
                        ? "success"
                        : kpi?.kycStatus === "rejected"
                          ? "error"
                          : kpi?.kycStatus === "pending"
                            ? "warning"
                            : "neutral";

                    const productsTotal = Number(kpi?.productsTotal || 0) || 0;
                    const productsPublished =
                      Number(kpi?.productsPublished || 0) || 0;
                    const productsFlagged =
                      Number(kpi?.productsFlagged || 0) || 0;
                    const outOfStock =
                      Number(kpi?.productsOutOfStock || 0) || 0;
                    const lowStock = Number(kpi?.productsLowStock || 0) || 0;

                    const stockRiskLabel =
                      outOfStock > 0 ? "Out" : lowStock > 0 ? "Low" : "OK";
                    const stockRiskVariant =
                      outOfStock > 0
                        ? "error"
                        : lowStock > 0
                          ? "warning"
                          : "success";

                    return (
                      <TableRow key={u.id} data-testid={`admin-merchant-row-${u.id}`}>
                        <TableCell data-testid={`admin-merchant-row-${u.id}-user`}>
                          <div className="flex items-center gap-3">
                            <Avatar
                              imageUrl={u.image}
                              color={u.color}
                              className="h-8 w-8"
                              data-testid={`admin-merchant-row-${u.id}-avatar`}
                            >
                              <AvatarFallback>
                                {(u?.name || u?.email || "")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link
                                href={`/admin/merchants/${u.id}`}
                                className="font-medium hover:underline"
                                data-testid={`admin-merchant-view-${u.id}`}
                              >
                                {u.name || "Unnamed"}
                              </Link>
                              <div
                                className="text-xs text-muted-foreground"
                                data-testid={`admin-merchant-row-${u.id}-email`}
                              >
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`admin-merchant-row-${u.id}-kyc`}>
                          <div className="space-y-1">
                            <Badge variant={kycVariant} data-testid={`admin-merchant-row-${u.id}-kyc-badge`}>
                              {kycLabel}
                            </Badge>
                            {kpi?.kycReviewedAt ? (
                              <div
                                className="text-[11px] text-muted-foreground"
                                data-testid={`admin-merchant-row-${u.id}-kyc-reviewed`}
                              >
                                Reviewed: {fmtDateTimeUtc(kpi.kycReviewedAt)}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`admin-merchant-row-${u.id}-products`}>
                          <div className="tabular-nums">
                            <div
                              className="font-medium"
                              data-testid={`admin-merchant-row-${u.id}-products-value`}
                            >
                              {productsPublished}/{productsTotal}
                            </div>
                            <div
                              className="text-[11px] text-muted-foreground"
                              data-testid={`admin-merchant-row-${u.id}-products-label`}
                            >
                              Published/Total
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums"
                          data-testid={`admin-merchant-row-${u.id}-flagged`}
                        >
                          {productsFlagged}
                        </TableCell>
                        {/* outOfStock counts products where inStock = false or stock ≤ 0.
lowStock counts products with a positive stock level that’s at or below the low-stock threshold (currently 5 units). */}
                        <TableCell className="text-right" data-testid={`admin-merchant-row-${u.id}-stock-risk`}>
                          <Badge
                            variant={stockRiskVariant}
                            data-testid={`admin-merchant-row-${u.id}-stock-risk-badge`}
                          >
                            {stockRiskLabel}
                          </Badge>
                          <div
                            className="text-[11px] text-muted-foreground tabular-nums mt-1"
                            data-testid={`admin-merchant-row-${u.id}-stock-risk-meta`}
                          >
                            {outOfStock} out, {lowStock} low
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums"
                          data-testid={`admin-merchant-row-${u.id}-buyer-paid`}
                        >
                          {fmtUsd(kpi?.revenue30d || 0)}
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums"
                          data-testid={`admin-merchant-row-${u.id}-units`}
                        >
                          {Number(kpi?.unitsSold30d || 0) || 0}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`admin-merchant-row-${u.id}-payouts`}>
                          <div className="tabular-nums">
                            <div
                              className="font-medium"
                              data-testid={`admin-merchant-row-${u.id}-payouts-owed`}
                            >
                              {fmtUsd(kpi?.payoutsOwed || 0)}
                            </div>
                            <div
                              className="text-[11px] text-muted-foreground"
                              data-testid={`admin-merchant-row-${u.id}-payouts-paid`}
                            >
                              Paid: {fmtUsd(kpi?.payoutsCompleted || 0)}
                            </div>
                            <div
                              className="text-[11px] text-muted-foreground"
                              data-testid={`admin-merchant-row-${u.id}-payouts-pending`}
                            >
                              In-flight: {fmtUsd(kpi?.payoutsPending || 0)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-sm"
                          data-testid={`admin-merchant-row-${u.id}-last-paid`}
                        >
                          {fmtDateTimeUtc(kpi?.lastPaidAt)}
                        </TableCell>
                        <TableCell
                          className="text-sm"
                          data-testid={`admin-merchant-row-${u.id}-settlement`}
                        >
                          {kpi?.lastSettlementTo || "-"}
                        </TableCell>
                        <TableCell data-testid={`admin-merchant-row-${u.id}-status`}>
                          <Badge
                            variant={u.merchant ? "success" : "neutral"}
                            data-testid={`admin-merchant-row-${u.id}-status-badge`}
                          >
                            {u.merchant ? "Merchant" : "Not Merchant"}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`admin-merchant-row-${u.id}-actions`}>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              asChild
                              data-testid={`admin-merchant-details-${u.id}`}
                            >
                              <Link href={`/admin/merchants/${u.id}`}>
                                View
                              </Link>
                            </Button>
                            <form action={toggleMerchant}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input
                                type="hidden"
                                name="makeMerchant"
                                value={u.merchant ? "false" : "true"}
                              />
                              <Button
                                size="sm"
                                variant={u.merchant ? "outline" : "default"}
                                data-testid={`admin-merchant-toggle-${u.id}`}
                              >
                                {u.merchant
                                  ? "Remove Merchant"
                                  : "Make Merchant"}
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && merchants.length === 0 && (
                    <TableRow data-testid="admin-merchants-empty">
                      <TableCell
                        colSpan={12}
                        className="text-center text-sm text-muted-foreground"
                        data-testid="admin-merchants-empty-cell"
                      >
                        No merchants yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4" data-testid="admin-merchants-pagination">
                <PaginationSmart
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={toPage}
                />
              </div>
            </TabsContent>

            <TabsContent value="applicants" data-testid="admin-applicants-tab-content">
              <Table data-testid="admin-applicants-table">
                <TableHeader data-testid="admin-applicants-head">
                  <TableRow data-testid="admin-applicants-head-row">
                    <TableHead data-testid="admin-applicants-head-user">User</TableHead>
                    <TableHead data-testid="admin-applicants-head-status">Status</TableHead>
                    <TableHead data-testid="admin-applicants-head-level">Level</TableHead>
                    <TableHead data-testid="admin-applicants-head-submitted">Submitted</TableHead>
                    <TableHead data-testid="admin-applicants-head-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-applicants-body">
                  {applicants.map((k) => (
                    <TableRow key={k.id} data-testid={`admin-applicant-row-${k.id}`}>
                      <TableCell data-testid={`admin-applicant-row-${k.id}-user`}>
                        <div className="flex items-center gap-3">
                          <Avatar
                            imageUrl={k?.User?.image}
                            color={k?.User?.color}
                            className="h-8 w-8"
                            data-testid={`admin-applicant-row-${k.id}-avatar`}
                          >
                            <AvatarFallback>
                              {(k?.User?.name || k?.User?.email || "")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div
                              className="font-medium"
                              data-testid={`admin-applicant-row-${k.id}-user-name`}
                            >
                              {k?.User?.name || k?.User?.email}
                            </div>
                            <div
                              className="text-xs text-muted-foreground"
                              data-testid={`admin-applicant-row-${k.id}-user-email`}
                            >
                              {k?.User?.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`admin-applicant-row-${k.id}-status`}>
                        <Badge
                          variant={
                            k.status === "approved"
                              ? "success"
                              : k.status === "rejected"
                                ? "error"
                                : "warning"
                          }
                        >
                          {k.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="capitalize"
                        data-testid={`admin-applicant-row-${k.id}-level`}
                      >
                        {k.level}
                      </TableCell>
                      <TableCell data-testid={`admin-applicant-row-${k.id}-submitted`}>
                        {k.submitted_at
                          ? new Date(k.submitted_at).toLocaleString("en-US", {
                              timeZone: "UTC",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell data-testid={`admin-applicant-row-${k.id}-actions`}>
                        <Link
                          className="text-primary underline text-xs"
                          href="/admin/kyc"
                          data-testid={`admin-applicant-review-${k.id}`}
                        >
                          Review KYC
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && applicants.length === 0 && (
                    <TableRow data-testid="admin-applicants-empty">
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                        data-testid="admin-applicants-empty-cell"
                      >
                        No applicants yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="mt-4" data-testid="admin-applicants-pagination">
                <PaginationSmart
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={toPage}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
