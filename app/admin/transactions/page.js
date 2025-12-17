"use client";

import React, { useEffect } from "react";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../../components/ui/pagination";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";

export default function TransactionsPage() {
  const { transactionsQuery, transactionsParams, setTransactionsParams } =
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
    setTransactionsParams((p) => ({
      ...p,
      page: qs.page,
      pageSize: qs.pageSize,
      from: qs.from,
      to: qs.to,
    }));
    transactionsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = transactionsQuery?.data?.data || [];
  const loading = transactionsQuery?.isFetching || transactionsQuery?.isLoading;
  const page = transactionsQuery?.data?.page || transactionsParams.page || 1;
  const pageSize =
    transactionsQuery?.data?.pageSize || transactionsParams.pageSize || 20;
  const total = transactionsQuery?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin Transactions</CardTitle>
            <Button
              onClick={() => transactionsQuery.refetch()}
              disabled={loading}
            >
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
                value={transactionsParams.from || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setTransactionsParams((p) => ({ ...p, page: 1, from: v }));
                  setQs({ from: v, page: 1 });
                }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={transactionsParams.to || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setTransactionsParams((p) => ({ ...p, page: 1, to: v }));
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
                  setTransactionsParams((p) => ({
                    ...p,
                    page: 1,
                    pageSize: v,
                  }));
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
            <Button
              variant="outline"
              onClick={() => transactionsQuery.refetch()}
            >
              Apply
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const qs = new URLSearchParams();
                if (transactionsParams.from)
                  qs.set("from", transactionsParams.from);
                if (transactionsParams.to) qs.set("to", transactionsParams.to);
                qs.set("format", "csv");
                window.open(
                  `/api/admin/transactions?${qs.toString()}`,
                  "_blank"
                );
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
                  <TableCell>{tx.amount}</TableCell>
                  <TableCell>{tx.currency}</TableCell>
                  <TableCell className="capitalize">{tx.status}</TableCell>
                  <TableCell>{tx.transaction_reference || "-"}</TableCell>
                  <TableCell>
                    {tx.createdAt
                      ? new Date(tx.createdAt).toLocaleString()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No transactions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    disabled={page <= 1}
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.max(1, page - 1);
                      setTransactionsParams((p) => ({ ...p, page: np }));
                      setQs({ page: np });
                      transactionsQuery.refetch();
                    }}
                  />
                </PaginationItem>
                <span className="px-3 text-sm">
                  Page {page} of {totalPages}
                </span>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    disabled={page >= totalPages}
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.min(totalPages, page + 1);
                      setTransactionsParams((p) => ({ ...p, page: np }));
                      setQs({ page: np });
                      transactionsQuery.refetch();
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
