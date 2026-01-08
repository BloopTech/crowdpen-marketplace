"use client";

import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PaginationSmart } from "../../components/ui/pagination";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { useAdminTransactions } from "./context";

export default function AdminTransactionsContent() {
  const {
    list,
    loading,
    page,
    pageSize,
    totalPages,
    params,
    fmt,
    setFrom,
    setTo,
    setPage,
    setPageSize,
    refetch,
  } = useAdminTransactions();

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin Transactions</CardTitle>
            <Button onClick={refetch} disabled={loading}>
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
                value={params.from || ""}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={params.to || ""}
                onChange={(e) => setTo(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            <Button variant="outline" onClick={refetch}>
              Apply
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const qs = new URLSearchParams();
                if (params.from) qs.set("from", params.from);
                if (params.to) qs.set("to", params.to);
                qs.set("format", "csv");
                window.open(`/api/admin/transactions?${qs.toString()}`, "_blank");
              }}
            >
              Export CSV
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
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
                  <TableCell className="capitalize">{tx.trans_type}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar imageUrl={tx?.User?.image} color={tx?.User?.color} className="h-8 w-8">
                        <AvatarFallback>
                          {(tx?.User?.name || tx?.User?.email || "").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {tx?.User?.name || tx?.User?.email || tx.recipient_id}
                        </div>
                        <div className="text-xs text-muted-foreground">{tx?.User?.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{fmt(tx.amount, tx.currency)}</TableCell>
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
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No transactions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4">
            <PaginationSmart currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
