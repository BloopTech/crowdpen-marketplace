"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PaginationSmart } from "../../components/ui/pagination";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";

export default function TicketsPage() {
  const { ticketsQuery, ticketsParams, setTicketsParams } = useAdmin();
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      q: parseAsString.withDefault(""),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    setTicketsParams((p) => ({ ...p, page: qs.page, pageSize: qs.pageSize, q: qs.q }));
    ticketsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = ticketsQuery?.data?.data || [];
  const loading = ticketsQuery?.isFetching || ticketsQuery?.isLoading;
  const page = ticketsQuery?.data?.page || ticketsParams.page || 1;
  const pageSize = ticketsQuery?.data?.pageSize || ticketsParams.pageSize || 20;
  const total = ticketsQuery?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tickets</CardTitle>
            <Button onClick={() => ticketsQuery.refetch()} disabled={loading}>
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
                placeholder="Subject, user..."
                value={ticketsParams.q || ""}
                onChange={(e) => { const v = e.target.value; setTicketsParams((p) => ({ ...p, page: 1, q: v })); setQs({ q: v, page: 1 }); }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => { const v = Number(e.target.value); setTicketsParams((p) => ({ ...p, page: 1, pageSize: v })); setQs({ pageSize: v, page: 1 }); }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button variant="outline" onClick={() => ticketsQuery.refetch()}>Apply</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{t.subject || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar imageUrl={t?.user?.image} color={t?.user?.color} className="h-8 w-8">
                        <AvatarFallback>{(t?.user?.name || t?.user?.email || "").slice(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{t.user?.name || t.user?.email || t.user?.id || "-"}</div>
                        <div className="text-xs text-muted-foreground">{t.user?.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{t.status || "open"}</TableCell>
                  <TableCell>{t.createdAt ? new Date(t.createdAt).toLocaleString("en-US", { timeZone: "UTC" }) : "-"}</TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No tickets yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4">
            <PaginationSmart
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(np) => {
                setTicketsParams((p) => ({ ...p, page: np }));
                setQs({ page: np });
                ticketsQuery.refetch();
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
