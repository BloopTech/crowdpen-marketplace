"use client";

import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PaginationSmart } from "../../components/ui/pagination";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { useAdminTickets } from "./context";

export default function AdminTicketsContent() {
  const {
    list,
    loading,
    page,
    pageSize,
    totalPages,
    search,
    setSearch,
    setPage,
    setPageSize,
    refetch,
  } = useAdminTickets();

  return (
    <div className="px-4 space-y-6" data-testid="admin-tickets-page">
      <Card data-testid="admin-tickets-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tickets</CardTitle>
            <Button onClick={refetch} disabled={loading} data-testid="admin-tickets-refresh">
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-tickets-search"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-tickets-page-size"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button variant="outline" onClick={refetch} data-testid="admin-tickets-apply">
              Apply
            </Button>
          </div>
          <Table data-testid="admin-tickets-table">
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
                <TableRow key={t.id} data-testid={`admin-ticket-row-${t.id}`}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{t.subject || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar imageUrl={t?.user?.image} color={t?.user?.color} className="h-8 w-8">
                        <AvatarFallback>
                          {(t?.user?.name || t?.user?.email || "").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {t.user?.name || t.user?.email || t.user?.id || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">{t.user?.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{t.status || "open"}</TableCell>
                  <TableCell>
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow data-testid="admin-tickets-empty">
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No tickets yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4" data-testid="admin-tickets-pagination">
            <PaginationSmart
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
