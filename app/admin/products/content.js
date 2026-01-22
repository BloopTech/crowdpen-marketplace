"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { PaginationSmart } from "../../components/ui/pagination";
import { useAdminProductDialog } from "./details-context";
import { useAdminProducts } from "./list-context";

export default function AdminProductsContent() {
  const { openDetails } = useAdminProductDialog();
  const {
    qs,
    setQs,
    list,
    loading,
    page,
    pageSize,
    totalPages,
    refetch,
    toggleFeatured,
    toggleFlagged,
    togglePending,
  } = useAdminProducts();

  const onToggleFeatured = (id, featured) => {
    toggleFeatured(id, !!featured);
  };

  const onToggleFlagged = (id, flagged) => {
    toggleFlagged(id, !!flagged);
  };

  const fmtMoney = (v, currency) => {
    const cur = (currency || "").toString().trim().toUpperCase();
    const code = /^[A-Z]{3}$/.test(cur) ? cur : "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));
  };

  return (
    <div className="px-4 space-y-6" data-testid="admin-products-page">
      <Card data-testid="admin-products-card">
        <CardHeader data-testid="admin-products-header">
          <div className="flex items-center justify-between" data-testid="admin-products-title-row">
            <CardTitle data-testid="admin-products-title">Products</CardTitle>
            <Button
              onClick={() => refetch()}
              disabled={loading}
              data-testid="admin-products-refresh"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4" data-testid="admin-products-filters">
            <div>
              <label className="block text-xs mb-1">Search</label>
              <Input
                type="text"
                placeholder="Title, description..."
                value={qs.q || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setQs({ q: v, page: 1 });
                }}
                className="min-w-56"
                data-testid="admin-products-search"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">From</label>
              <input
                type="date"
                value={qs.from || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setQs({ from: v, page: 1 });
                }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-products-from"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={qs.to || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setQs({ to: v, page: 1 });
                }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-products-to"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Featured</label>
              <Select value={qs.featured} onValueChange={(v) => setQs({ featured: v, page: 1 })}>
                <SelectTrigger className="w-40" data-testid="admin-products-featured">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Featured</SelectItem>
                  <SelectItem value="false">Not Featured</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs mb-1">Flagged</label>
              <Select value={qs.flagged} onValueChange={(v) => setQs({ flagged: v, page: 1 })}>
                <SelectTrigger className="w-40" data-testid="admin-products-flagged">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Flagged</SelectItem>
                  <SelectItem value="false">Not Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs mb-1">Sort</label>
              <Select value={qs.sort} onValueChange={(v) => setQs({ sort: v, page: 1 })}>
                <SelectTrigger className="w-48" data-testid="admin-products-sort">
                  <SelectValue placeholder="Rank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rank">Rank</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="downloads">Downloads</SelectItem>
                  <SelectItem value="bestsellers">Bestsellers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setQs({ pageSize: Number(v), page: 1 })}
              >
                <SelectTrigger className="w-28" data-testid="admin-products-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              data-testid="admin-products-apply"
            >
              Apply
            </Button>
          </div>

          <Table stickyFirstColumn data-testid="admin-products-table">
            <TableHeader data-testid="admin-products-head">
              <TableRow data-testid="admin-products-head-row">
                <TableHead data-testid="admin-products-head-title">Title</TableHead>
                <TableHead data-testid="admin-products-head-author">Author</TableHead>
                <TableHead data-testid="admin-products-head-featured">Featured</TableHead>
                <TableHead data-testid="admin-products-head-flagged">Flagged</TableHead>
                <TableHead data-testid="admin-products-head-units">Units Sold</TableHead>
                <TableHead data-testid="admin-products-head-revenue">Revenue</TableHead>
                <TableHead data-testid="admin-products-head-crowdpen">Crowdpen</TableHead>
                <TableHead data-testid="admin-products-head-gateway">Gateway</TableHead>
                <TableHead data-testid="admin-products-head-payout">Payout</TableHead>
                <TableHead data-testid="admin-products-head-rating">Rating</TableHead>
                <TableHead data-testid="admin-products-head-author-rating">
                  Author Rating
                </TableHead>
                <TableHead data-testid="admin-products-head-downloads">Downloads</TableHead>
                <TableHead data-testid="admin-products-head-in-stock">In Stock</TableHead>
                <TableHead data-testid="admin-products-head-stock">Stock</TableHead>
                <TableHead data-testid="admin-products-head-price">Price</TableHead>
                <TableHead data-testid="admin-products-head-rank">Rank</TableHead>
                <TableHead data-testid="admin-products-head-created">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="admin-products-body">
              {list.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => openDetails(p.id)}
                  className="cursor-pointer hover:bg-muted/30"
                  data-testid={`admin-product-row-${p.id}`}
                >
                  <TableCell data-testid={`admin-product-row-${p.id}-title`}>
                    <div
                      className="max-w-[320px] truncate"
                      title={p.title}
                      data-testid={`admin-product-row-${p.id}-title-text`}
                    >
                      {p.title}
                    </div>
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid={`admin-product-row-${p.id}-category`}
                    >
                      {p.category?.name || "-"}
                    </div>
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    data-testid={`admin-product-row-${p.id}-author`}
                  >
                    {p.author?.pen_name || p.author?.name || p.author?.id || "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-featured`}>
                    <Switch
                      checked={Boolean(p.featured)}
                      onCheckedChange={(checked) => onToggleFeatured(p.id, checked)}
                      disabled={togglePending}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      data-testid={`admin-product-featured-${p.id}`}
                    />
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-flagged`}>
                    <Switch
                      checked={Boolean(p.flagged)}
                      onCheckedChange={(checked) => onToggleFlagged(p.id, checked)}
                      disabled={togglePending}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      data-testid={`admin-product-flagged-${p.id}`}
                    />
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-units`}>
                    {Number(p.unitsSold || 0).toLocaleString("en-US")}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-revenue`}>
                    {fmtMoney(p.totalRevenue, p.currency)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-crowdpen`}>
                    {fmtMoney(p.crowdpenFee, p.currency)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-gateway`}>
                    {fmtMoney(p.startbuttonFee, p.currency)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-payout`}>
                    {fmtMoney(p.creatorPayout, p.currency)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-rating`}>
                    {Number(p.rating || 0).toFixed(1)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-author-rating`}>
                    {Number(p.authorRating || 0).toFixed(1)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-downloads`}>
                    {Number(p.downloads || 0)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-in-stock`}>
                    {p.inStock ? "Yes" : "No"}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-stock`}>
                    {typeof p.stock === "number" ? p.stock : p.stock ?? "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-price`}>
                    {isNaN(Number(p.price)) ? "-" : Number(p.price).toFixed(2)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-rank`}>
                    {Number(p.rankScore || 0).toFixed(2)}
                  </TableCell>
                  <TableCell data-testid={`admin-product-row-${p.id}-created`}>
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow data-testid="admin-products-empty">
                  <TableCell
                    colSpan={17}
                    className="text-center text-sm text-muted-foreground"
                    data-testid="admin-products-empty-cell"
                  >
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4" data-testid="admin-products-pagination">
            <PaginationSmart
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(np) => setQs({ page: np })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
