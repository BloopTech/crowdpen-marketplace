"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import { Avatar } from "../../components/ui/avatar";
import { useAdminProductDialog } from "./details-context";
import { FileText, Download } from "lucide-react";
import Link from "next/link";

function fetchAdminProduct(id) {
  return fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
    credentials: "include",
    cache: "no-store",
  }).then(async (res) => {
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
  const scrollRef = useRef(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => fetchAdminProduct(productId),
    enabled,
  });

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.focus();
    }
  }, [open, productId]);

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
                  <Image
                    src={images[0]}
                    alt={data?.title || "Product image"}
                    fill
                    className="object-cover"
                  />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.slice(0, 8).map((src, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 rounded overflow-hidden border border-border"
                      >
                        <Image
                          src={src}
                          alt={`${data?.title || "Product"} ${i + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[280px] text-sm text-muted-foreground">
                No images
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="p-4 lg:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-start justify-between gap-3">
                <span className="text-lg lg:text-xl">
                  {data?.title || (isLoading ? "Loading..." : "Untitled")}
                </span>
                <div className="flex gap-2 items-center">
                  {data?.featured ? (
                    <Badge variant="default">Featured</Badge>
                  ) : (
                    <Badge variant="neutral">Not Featured</Badge>
                  )}
                  {data?.flagged ? (
                    <Badge variant="warning">Flagged</Badge>
                  ) : (
                    <Badge variant="neutral">Not Flagged</Badge>
                  )}
                </div>
              </DialogTitle>
              {data?.product_id && (
                <DialogDescription>
                  Product ID: {data.product_id}
                </DialogDescription>
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
              <div className="text-sm text-red-500">
                {error.message || "Failed to load product"}
              </div>
            ) : (
              <div
                ref={scrollRef}
                tabIndex={0}
                className="h-[62vh] pr-2 overflow-y-auto focus:outline-none"
                aria-label="Product details"
              >
                <div className="space-y-5">
                  {/* Owner */}
                  <div className="flex items-center gap-3">
                    <Avatar
                      imageUrl={data?.owner?.image}
                      initials={(
                        data?.owner?.pen_name ||
                        data?.owner?.name ||
                        "?"
                      ).slice(0, 2)}
                    />
                    <div>
                      <Link href={`/author/${data?.owner?.pen_name}`}>
                        <div className="font-medium text-sm">
                          {data?.owner?.pen_name ||
                            data?.owner?.name ||
                            "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {data?.owner?.email || "No email"}
                        </div>
                      </Link>
                      {data?.owner?.kycStatus && (
                        <div className="text-xs mt-1">
                          KYC:{" "}
                          <Badge
                            variant={
                              data.owner.kycStatus === "approved"
                                ? "success"
                                : "warning"
                            }
                          >
                            {data.owner.kycStatus}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing & Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Price</div>
                      <div className="text-base font-semibold">
                        {data?.price != null
                          ? `$${Number(data.price).toFixed(2)}`
                          : "-"}
                      </div>
                      {data?.originalPrice != null &&
                        data.originalPrice !== data.price && (
                          <div className="text-xs text-muted-foreground line-through">
                            ${Number(data.originalPrice).toFixed(2)}
                          </div>
                        )}
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Rating
                      </div>
                      <div className="text-base font-semibold">
                        {Number(data?.rating || 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {data?.reviewCount || 0} reviews
                      </div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Downloads
                      </div>
                      <div className="text-base font-semibold">
                        {Number(data?.downloads || 0)}
                      </div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Inventory
                      </div>
                      <div className="text-base font-semibold">
                        {data?.inStock ? "In stock" : "Out of stock"}
                      </div>
                    </div>
                  </div>

                  {/* Sales & Revenue */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Units Sold</div>
                      <div className="text-base font-semibold">{Number(data?.unitsSold || 0)}</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Total Revenue</div>
                      <div className="text-base font-semibold">${Number(data?.totalRevenue || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Crowdpen Fee</div>
                      <div className="text-base font-semibold">${Number(data?.crowdpenFee || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Gateway Fee</div>
                      <div className="text-base font-semibold">${Number(data?.startbuttonFee || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded border border-border p-3 col-span-2">
                      <div className="text-xs text-muted-foreground">Creator Payout</div>
                      <div className="text-base font-semibold">${Number(data?.creatorPayout || 0).toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Category
                      </div>
                      <div className="text-sm">
                        {data?.category?.name || "-"}
                      </div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Subcategory
                      </div>
                      <div className="text-sm">
                        {data?.subcategory?.name || "-"}
                      </div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Updated
                      </div>
                      <div className="text-sm">
                        {data?.lastUpdated
                          ? new Date(data.lastUpdated).toLocaleString("en-US", { timeZone: "UTC" })
                          : "-"}
                      </div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Created
                      </div>
                      <div className="text-sm">
                        {data?.createdAt
                          ? new Date(data.createdAt).toLocaleString("en-US", { timeZone: "UTC" })
                          : "-"}
                      </div>
                    </div>
                  </div>

                  {/* File info */}
                  <div className="rounded border border-border p-3 space-y-3">
                    <div className="flex items-start flex-col space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          File
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs font-medium max-w-[260px]">
                          <FileText className="size-8" />
                          <span
                            className="truncate line-clamp-1"
                            title={
                              data?.fileName || data?.fileType || "Product file"
                            }
                          >
                            {data?.fileName || data?.fileType || "Product file"}
                          </span>
                        </div>
                      </div>
                      {data?.fileUrl ? (
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Link
                            href={data.fileUrl}
                            download={data.fileName || undefined}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded border border-border px-2 py-1 hover:bg-muted transition"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Link>
                          <Link
                            href={data.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium rounded border border-border px-2 py-1 hover:bg-muted transition"
                          >
                            View
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No file uploaded
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span className="break-all">
                        Type: {data?.fileType || "-"}
                      </span>
                      <span className="break-all">
                        Size: {data?.fileSize || "-"}
                      </span>
                      <span className="break-all">
                        Extension: {data?.fileExtension || "-"}
                      </span>
                      <span className="break-all">
                        License: {data?.license || "-"}
                      </span>
                      <span className="break-all">
                        Included: {data?.what_included ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {Array.isArray(data?.tags) && data.tags.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {data.tags.map((t) => (
                          <Badge key={t.id || t.tag_id} variant="neutral">
                            {t.label || t.name || t.tag_id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Description
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                      {data?.description || "-"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
