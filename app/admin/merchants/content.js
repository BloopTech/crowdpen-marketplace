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
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Merchants & Applicants</CardTitle>
            <Button onClick={refresh} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1">Search</label>
              <input
                type="text"
                placeholder="Name or email"
                value={searchValue}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-ring"
              />
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
            <Button variant="outline" onClick={refresh}>
              Apply
            </Button>
          </div>
          {error ? (
            <div className="text-destructive text-sm">{error}</div>
          ) : null}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="merchants">Merchants</TabsTrigger>
              <TabsTrigger value="applicants">Applicants</TabsTrigger>
            </TabsList>

            <TabsContent value="merchants">
              <Table stickyFirstColumn>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Flagged</TableHead>
                    <TableHead className="text-right">Stock Risk</TableHead>
                    <TableHead className="text-right">Buyer Paid (30d)</TableHead>
                    <TableHead className="text-right">Units (30d)</TableHead>
                    <TableHead className="text-right">Payouts (Owed)</TableHead>
                    <TableHead>Last Paid</TableHead>
                    <TableHead>Last Settled To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar
                              imageUrl={u.image}
                              color={u.color}
                              className="h-8 w-8"
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
                              >
                                {u.name || "Unnamed"}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={kycVariant}>{kycLabel}</Badge>
                            {kpi?.kycReviewedAt ? (
                              <div className="text-[11px] text-muted-foreground">
                                Reviewed: {fmtDateTimeUtc(kpi.kycReviewedAt)}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="tabular-nums">
                            <div className="font-medium">
                              {productsPublished}/{productsTotal}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Published/Total
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {productsFlagged}
                        </TableCell>
                        {/* outOfStock counts products where inStock = false or stock ≤ 0.
lowStock counts products with a positive stock level that’s at or below the low-stock threshold (currently 5 units). */}
                        <TableCell className="text-right">
                          <Badge variant={stockRiskVariant}>
                            {stockRiskLabel}
                          </Badge>
                          <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
                            {outOfStock} out, {lowStock} low
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtUsd(kpi?.revenue30d || 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(kpi?.unitsSold30d || 0) || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="tabular-nums">
                            <div className="font-medium">
                              {fmtUsd(kpi?.payoutsOwed || 0)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Paid: {fmtUsd(kpi?.payoutsCompleted || 0)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              In-flight: {fmtUsd(kpi?.payoutsPending || 0)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {fmtDateTimeUtc(kpi?.lastPaidAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {kpi?.lastSettlementTo || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.merchant ? "success" : "neutral"}>
                            {u.merchant ? "Merchant" : "Not Merchant"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" asChild>
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
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No merchants yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4">
                <PaginationSmart
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={toPage}
                />
              </div>
            </TabsContent>

            <TabsContent value="applicants">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicants.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            imageUrl={k?.User?.image}
                            color={k?.User?.color}
                            className="h-8 w-8"
                          >
                            <AvatarFallback>
                              {(k?.User?.name || k?.User?.email || "")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {k?.User?.name || k?.User?.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {k?.User?.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
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
                      <TableCell className="capitalize">{k.level}</TableCell>
                      <TableCell>
                        {k.submitted_at
                          ? new Date(k.submitted_at).toLocaleString("en-US", {
                              timeZone: "UTC",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Link
                          className="text-primary underline text-xs"
                          href="/admin/kyc"
                        >
                          Review KYC
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && applicants.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No applicants yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="mt-4">
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
