"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import ProductDetailsDialog from "./ProductDetailsDialog";
import { AdminProductDialogProvider, useAdminProductDialog } from "./details-context";
import { AdminProductsProvider, useAdminProducts } from "./list-context";

function AdminProductsInner() {
  const { openDetails } = useAdminProductDialog();
  const {
    qs,
    setQs,
    list,
    loading,
    page,
    pageSize,
    total,
    totalPages,
    refetch,
    toggleFeatured,
    togglePending,
  } = useAdminProducts();

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products</CardTitle>
            <Button onClick={() => refetch()} disabled={loading}>
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
                <TableRow key={p.id} onClick={() => openDetails(p.id)} className="cursor-pointer hover:bg-muted/30">
                  <TableCell>
                    <div className="max-w-[320px] truncate" title={p.title}>{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.category?.name || "-"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{p.author?.pen_name || p.author?.name || p.author?.id || "-"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={Boolean(p.featured)}
                      onCheckedChange={(checked) => toggleFeatured(p.id, checked)}
                      disabled={togglePending}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
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

export default function AdminProductsPage() {
  return (
    <AdminProductsProvider>
      <AdminProductDialogProvider>
        <AdminProductsInner />
        <ProductDetailsDialog />
      </AdminProductDialogProvider>
    </AdminProductsProvider>
  );
}
