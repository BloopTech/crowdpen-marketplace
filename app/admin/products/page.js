"use client";

import React, { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";

function fetchJson(url) {
  return fetch(url, { credentials: "include", cache: "no-store" }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      const message = data?.message || `Failed to fetch ${url}`;
      throw new Error(message);
    }
    return data;
  });
}

export default function AdminProductsPage() {
  const qc = useQueryClient();
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      q: parseAsString.withDefault(""),
      featured: parseAsString.withDefault("all"), // all | true | false
      sort: parseAsString.withDefault("rank"), // rank | newest | price-low | price-high | rating | downloads
    },
    { clearOnDefault: true }
  );

  const queryKey = useMemo(() => ["admin", "products", qs], [qs]);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      const searchParams = new URLSearchParams({
        page: String(qs.page || 1),
        pageSize: String(qs.pageSize || 20),
        sort: qs.sort || "rank",
      });
      if (qs.q) searchParams.set("q", qs.q);
      if (qs.featured && qs.featured !== "all") searchParams.set("featured", qs.featured);
      return fetchJson(`/api/admin/products?${searchParams.toString()}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, featured }) => {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, featured }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to update product");
      }
      return data?.data;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old) => {
        const next = { ...(old || {}) };
        next.data = (old?.data || []).map((p) => (p.id === vars.id ? { ...p, featured: vars.featured } : p));
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const list = query?.data?.data || [];
  const loading = query?.isFetching || query?.isLoading;
  const page = query?.data?.page || qs.page || 1;
  const pageSize = query?.data?.pageSize || qs.pageSize || 20;
  const total = query?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    // Trigger first fetch on mount
    query.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products</CardTitle>
            <Button onClick={() => query.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1">Search</label>
              <Input
                type="text"
                placeholder="Title, description..."
                value={qs.q || ""}
                onChange={(e) => {
                  const v = e.target.value; setQs({ q: v, page: 1 });
                }}
                className="min-w-56"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Featured</label>
              <Select value={qs.featured} onValueChange={(v) => setQs({ featured: v, page: 1 })}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Featured</SelectItem>
                  <SelectItem value="false">Not Featured</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs mb-1">Sort</label>
              <Select value={qs.sort} onValueChange={(v) => setQs({ sort: v, page: 1 })}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Rank" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rank">Rank</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="downloads">Downloads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <Select value={String(pageSize)} onValueChange={(v) => setQs({ pageSize: Number(v), page: 1 })}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => query.refetch()}>Apply</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Author Rating</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="max-w-[320px] truncate" title={p.title}>{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.category?.name || "-"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{p.author?.pen_name || p.author?.name || p.author?.id || "-"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={Boolean(p.featured)}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: p.id, featured: checked })}
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>
                  <TableCell>{Number(p.rating || 0).toFixed(1)}</TableCell>
                  <TableCell>{Number(p.authorRating || 0).toFixed(1)}</TableCell>
                  <TableCell>{Number(p.downloads || 0)}</TableCell>
                  <TableCell>{isNaN(Number(p.price)) ? "-" : Number(p.price).toFixed(2)}</TableCell>
                  <TableCell>{Number(p.rankScore || 0).toFixed(2)}</TableCell>
                  <TableCell>{p.createdAt ? new Date(p.createdAt).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">No products found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" disabled={page <= 1} onClick={(e) => { e.preventDefault(); const np = Math.max(1, page - 1); setQs({ page: np }); }} />
                </PaginationItem>
                <span className="px-3 text-sm">Page {page} of {totalPages}</span>
                <PaginationItem>
                  <PaginationNext href="#" disabled={page >= totalPages} onClick={(e) => { e.preventDefault(); const np = Math.min(totalPages, page + 1); setQs({ page: np }); }} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
