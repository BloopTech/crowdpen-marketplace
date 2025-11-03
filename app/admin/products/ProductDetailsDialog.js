"use client";

import React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import { Avatar } from "../../components/ui/avatar";
import { ScrollArea } from "../../components/ui/scroll-area";
import { useAdminProductDialog } from "./details-context";

function fetchAdminProduct(id) {
  return fetch(`/api/admin/products/${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to load product");
      }
      return data.data;
    });
}

export default function ProductDetailsDialog() {
  const { open, setOpen, productId } = useAdminProductDialog();
  const enabled = !!productId;
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => fetchAdminProduct(productId),
    enabled,
  });

  const images = data?.images || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl p-0 max-h-[85vh] overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: Media */}
          <div className="bg-muted/20 p-4 lg:p-6">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="w-full aspect-[4/3] rounded" />
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="w-16 h-16 rounded" />
                  ))}
                </div>
              </div>
            ) : images?.length ? (
              <div className="space-y-3">
                <div className="relative w-full aspect-[4/3] rounded overflow-hidden bg-background">
                  <Image src={images[0]} alt={data?.title || "Product image"} fill className="object-cover" />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.slice(0, 8).map((src, i) => (
                      <div key={i} className="relative w-16 h-16 rounded overflow-hidden border">
                        <Image src={src} alt={`${data?.title || "Product"} ${i + 1}`} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[280px] text-sm text-muted-foreground">No images</div>
            )}
          </div>

          {/* Right: Details */}
          <div className="p-4 lg:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-start justify-between gap-3">
                <span className="text-lg lg:text-xl">{data?.title || (isLoading ? "Loading..." : "Untitled")}</span>
                <div className="flex gap-2 items-center">
                  {data?.featured ? (
                    <Badge variant="default">Featured</Badge>
                  ) : (
                    <Badge variant="neutral">Not Featured</Badge>
                  )}
                </div>
              </DialogTitle>
              {data?.product_id && (
                <DialogDescription>Product ID: {data.product_id}</DialogDescription>
              )}
            </DialogHeader>

            <Separator className="my-4" />

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
              </div>
            ) : error ? (
              <div className="text-sm text-red-500">{error.message || "Failed to load product"}</div>
            ) : (
              <ScrollArea className="h-[62vh] pr-2">
                <div className="space-y-5">
                  {/* Owner */}
                  <div className="flex items-center gap-3">
                    <Avatar imageUrl={data?.owner?.image} initials={(data?.owner?.pen_name || data?.owner?.name || "?").slice(0,2)} />
                    <div>
                      <div className="font-medium text-sm">{data?.owner?.pen_name || data?.owner?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{data?.owner?.email || "No email"}</div>
                      {data?.owner?.kycStatus && (
                        <div className="text-xs mt-1">
                          KYC: <Badge variant={data.owner.kycStatus === 'approved' ? 'success' : 'warning'}>{data.owner.kycStatus}</Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing & Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Price</div>
                      <div className="text-base font-semibold">{data?.price != null ? `$${Number(data.price).toFixed(2)}` : "-"}</div>
                      {data?.originalPrice != null && data.originalPrice !== data.price && (
                        <div className="text-xs text-muted-foreground line-through">${Number(data.originalPrice).toFixed(2)}</div>
                      )}
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Rating</div>
                      <div className="text-base font-semibold">{Number(data?.rating || 0).toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">{data?.reviewCount || 0} reviews</div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Downloads</div>
                      <div className="text-base font-semibold">{Number(data?.downloads || 0)}</div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Inventory</div>
                      <div className="text-base font-semibold">{data?.inStock ? "In stock" : "Out of stock"}</div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Category</div>
                      <div className="text-sm">{data?.category?.name || "-"}</div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Subcategory</div>
                      <div className="text-sm">{data?.subcategory?.name || "-"}</div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Updated</div>
                      <div className="text-sm">{data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "-"}</div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Created</div>
                      <div className="text-sm">{data?.createdAt ? new Date(data.createdAt).toLocaleString() : "-"}</div>
                    </div>
                  </div>

                  {/* File info */}
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground mb-1">File</div>
                    <div className="text-sm flex flex-wrap gap-3">
                      <span>Type: {data?.fileType || '-'}</span>
                      <span>Size: {data?.fileSize || '-'}</span>
                      <span>License: {data?.license || '-'}</span>
                      <span>Included: {data?.what_included ? 'Yes' : 'No'}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {Array.isArray(data?.tags) && data.tags.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Tags</div>
                      <div className="flex flex-wrap gap-2">
                        {data.tags.map((t) => (
                          <Badge key={t.id || t.tag_id} variant="neutral">{t.label || t.name || t.tag_id}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Description</div>
                    <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">{data?.description || '-'}</div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
