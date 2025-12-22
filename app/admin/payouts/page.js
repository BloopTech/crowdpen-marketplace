"use client";

import React, { useEffect, useMemo } from "react";
import { useAdmin } from "../context";
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
PaginationSmart
} from "../../components/ui/pagination";
import { createPayout } from "./actions";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { useQuery } from "@tanstack/react-query";

export default function PayoutsPage() {
  const { payoutsQuery, merchantRecipientsQuery, payoutsParams, setPayoutsParams } =
    useAdmin();
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
    // Initialize from URL
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

  const list = payoutsQuery?.data?.data || [];
  const recipientsData = merchantRecipientsQuery?.data?.data;
  const users = useMemo(() => {
    const arr = Array.isArray(recipientsData) ? recipientsData : [];
    return arr.filter((u) => u?.merchant === true);
  }, [recipientsData]);
  const loading = payoutsQuery?.isFetching || payoutsQuery?.isLoading;
  const page = payoutsQuery?.data?.page || payoutsParams.page || 1;
  const pageSize = payoutsQuery?.data?.pageSize || payoutsParams.pageSize || 20;
  const total = payoutsQuery?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fmt = (v, currency) => {
    const cur = (currency || "").toString().trim().toUpperCase();
    const code = /^[A-Z]{3}$/.test(cur) ? cur : "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));
  };

  const fetchJson = async (url) => {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      throw new Error(data?.message || `Failed to fetch ${url}`);
    }
    return data;
  };

  const merchantPayoutsQuery = useQuery({
    queryKey: ["admin", "analytics", "merchant-payouts"],
    queryFn: () => fetchJson("/api/admin/analytics/top-merchants?limit=100"),
  });

  const eligibleMerchantPayouts = useMemo(() => {
    if (!users.length || !Array.isArray(merchantPayoutsQuery?.data?.data)) {
      return [];
    }
    const eligibleIds = new Set(users.map((u) => u.id));
    return merchantPayoutsQuery.data.data
      .filter((row) => eligibleIds.has(row.merchantId))
      .map((row) => {
        const revenue = Number(row.revenue || 0);
        const crowdpenFee = Number(row.crowdpenFee || 0);
        const startbuttonFee = Number(row.startbuttonFee || 0);
        const creatorPayout =
          row.creatorPayout != null
            ? Number(row.creatorPayout)
            : Math.max(0, revenue - crowdpenFee - startbuttonFee);
        const matchedUser = users.find((u) => u.id === row.merchantId);
        return {
          merchantId: row.merchantId,
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
          currency: row.currency || "USD",
        };
      });
  }, [merchantPayoutsQuery?.data?.data, users]);

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payouts</CardTitle>
            <Button onClick={() => payoutsQuery.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1">From</label>
              <input
                type="date"
                value={payoutsParams.from || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setPayoutsParams((p) => ({ ...p, page: 1, from: v }));
                  setQs({ from: v, page: 1 });
                }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={payoutsParams.to || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setPayoutsParams((p) => ({ ...p, page: 1, to: v }));
                  setQs({ to: v, page: 1 });
                }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPayoutsParams((p) => ({ ...p, page: 1, pageSize: v }));
                  setQs({ pageSize: v, page: 1 });
                }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button variant="outline" onClick={() => payoutsQuery.refetch()}>
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
              <p className="text-sm text-muted-foreground">Loading merchant payout data…</p>
            ) : merchantPayoutsQuery.error ? (
              <p className="text-sm text-red-500">
                {merchantPayoutsQuery.error?.message || "Failed to load merchant payouts"}
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
                      <TableHead className="text-right">Crowdpen Share (15%)</TableHead>
                      <TableHead className="text-right">Startbutton Share (5%)</TableHead>
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
            <div>
              <label className="block text-xs mb-1">Recipient</label>
              <select
                name="recipient_id"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-48 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {users.map((u) => (
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
                placeholder="100"
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
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
                <option value={"pending"}>pending</option>
                <option value={"completed"}>completed</option>
                <option value={"failed"}>failed</option>
                <option value={"cancelled"}>cancelled</option>
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
            <Button type="submit">Create Payout</Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
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
                          {tx?.User?.name || tx?.User?.email || tx.recipient_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{fmt(Number(tx.amount || 0), tx.currency)}</TableCell>
                  <TableCell>{tx.currency}</TableCell>
                  <TableCell className="capitalize">{tx.status}</TableCell>
                  <TableCell>{tx.transaction_reference || "-"}</TableCell>
                  <TableCell>
                    {tx.createdAt
                      ? new Date(tx.createdAt).toLocaleString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
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
              onPageChange={(np) => {
                setPayoutsParams((p) => ({ ...p, page: np }));
                setQs({ page: np });
                payoutsQuery.refetch();
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
