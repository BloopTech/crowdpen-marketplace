"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PaginationSmart } from "../../components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useAdminErrors } from "./context";

function fetchErrorDetails(fingerprint) {
  return fetch(`/api/admin/errors/${encodeURIComponent(fingerprint)}`, {
    credentials: "include",
    cache: "no-store",
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      throw new Error(data?.message || "Failed to load error details");
    }
    return data.data;
  });
}

export default function AdminErrorsContent() {
  const {
    list,
    loading,
    page,
    pageSize,
    totalPages,
    params,
    search,
    setFrom,
    setTo,
    setSearch,
    setPage,
    setPageSize,
    refetch,
  } = useAdminErrors();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedFingerprint, setSelectedFingerprint] = useState(null);

  const openDetails = useCallback((fp) => {
    setSelectedFingerprint(fp);
    setDetailsOpen(true);
  }, []);

  const detailsEnabled = Boolean(detailsOpen && selectedFingerprint);
  const { data: detailsData, isLoading: detailsLoading, error: detailsError } = useQuery({
    queryKey: ["admin", "errors", "details", selectedFingerprint],
    queryFn: () => fetchErrorDetails(selectedFingerprint),
    enabled: detailsEnabled,
  });

  const detailsContextText = useMemo(() => {
    const raw = detailsData?.sample_context;
    if (!raw) return "";
    if (typeof raw === "string") {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    }
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }, [detailsData?.sample_context]);

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Errors</CardTitle>
            <Button onClick={refetch} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex-1 min-w-64">
              <label className="block text-xs mb-1">Search</label>
              <input
                type="text"
                placeholder="Fingerprint, route, message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">From</label>
              <input
                type="date"
                value={params?.from || ""}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={params?.to || ""}
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
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Last seen</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>PG code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((err) => (
                <TableRow
                  key={err.fingerprint}
                  className="cursor-pointer"
                  onClick={() => openDetails(err.fingerprint)}
                >
                  <TableCell>
                    {err.last_seen_at
                      ? new Date(err.last_seen_at).toLocaleString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                  <TableCell>{Number(err.event_count || 0) || 0}</TableCell>
                  <TableCell className="max-w-[320px] truncate">{err.route || "-"}</TableCell>
                  <TableCell>{err.method || "-"}</TableCell>
                  <TableCell className="max-w-[420px] truncate">
                    {err.error_name || "Error"}{err.sample_message ? `: ${err.sample_message}` : ""}
                  </TableCell>
                  <TableCell>{err.pg_code || "-"}</TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No errors.
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

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedFingerprint(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Error details</DialogTitle>
            <DialogDescription>
              {selectedFingerprint ? `Fingerprint: ${selectedFingerprint}` : ""}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : detailsError ? (
            <div className="text-sm text-red-500">
              {detailsError?.message || "Failed to load details"}
            </div>
          ) : detailsData ? (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="stack">Stack</TabsTrigger>
                <TabsTrigger value="context">Context</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">Last seen</div>
                    <div className="text-sm font-medium">
                      {detailsData.last_seen_at
                        ? new Date(detailsData.last_seen_at).toLocaleString("en-US", { timeZone: "UTC" })
                        : "-"}
                    </div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">Count</div>
                    <div className="text-sm font-medium">{Number(detailsData.event_count || 0) || 0}</div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">Route</div>
                    <div className="text-sm font-medium break-all">{detailsData.route || "-"}</div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">Method</div>
                    <div className="text-sm font-medium">{detailsData.method || "-"}</div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">Error</div>
                    <div className="text-sm font-medium break-all">{detailsData.error_name || "Error"}</div>
                    {detailsData.sample_message ? (
                      <div className="text-xs text-muted-foreground break-all mt-1">
                        {detailsData.sample_message}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">PG code</div>
                    <div className="text-sm font-medium">{detailsData.pg_code || "-"}</div>
                    {detailsData.constraint_name ? (
                      <div className="text-xs text-muted-foreground break-all mt-1">
                        {detailsData.constraint_name}
                      </div>
                    ) : null}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="stack">
                <pre className="text-xs whitespace-pre-wrap wrap-break-word rounded border border-border bg-muted/20 p-3 max-h-[55vh] overflow-auto">
                  {detailsData.sample_stack || "(no stack captured)"}
                </pre>
              </TabsContent>

              <TabsContent value="context">
                <pre className="text-xs whitespace-pre-wrap wrap-break-word rounded border border-border bg-muted/20 p-3 max-h-[55vh] overflow-auto">
                  {detailsContextText || "(no context captured)"}
                </pre>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-sm text-muted-foreground">No details.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
