"use server";
import React from "react";
import Link from "next/link";
import { db } from "../../../../models/index";
import MerchantSubpagePagination from "../MerchantSubpagePagination";

function fmtDateTimeUtc(v) {
  const d = v ? new Date(v) : null;
  if (!d || !Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("en-US", { timeZone: "UTC" });
}

export default async function AdminMerchantProductsPage({ params, searchParams }) {
  const { id } = await params;
  const merchantId = id;
  const { page, pageSize } = await searchParams;
  const getPage = Math.max(1, Number(page || 1) || 1);
  const getPageSize = Math.min(100, Math.max(1, Number(pageSize || 20) || 20));
  const offset = (getPage - 1) * getPageSize;

  const { rows, count } = await db.MarketplaceProduct.findAndCountAll({
    where: { user_id: merchantId },
    attributes: [
      "id",
      "product_id",
      "title",
      "currency",
      "price",
      "product_status",
      "flagged",
      "inStock",
      "stock",
      "createdAt",
    ],
    order: [["createdAt", "DESC"]],
    limit: getPageSize,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil((Number(count) || 0) / getPageSize));

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4">
        <div className="text-base font-semibold">Products</div>
        <div className="text-xs text-muted-foreground">
          Showing {rows.length.toLocaleString("en-US")} of {Number(count || 0).toLocaleString("en-US")}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Flagged</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-right p-3">Price (USD)</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const j = p.toJSON();
              return (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-muted-foreground">{j.product_id}</div>
                    <div className="text-xs text-muted-foreground">
                      <Link href="/admin/products" className="underline text-primary">
                        Open in Products
                      </Link>
                    </div>
                  </td>
                  <td className="p-3 capitalize">{j.product_status}</td>
                  <td className="p-3 text-right tabular-nums">{j.flagged ? "Yes" : "No"}</td>
                  <td className="p-3 text-right tabular-nums">{j.stock == null ? "-" : Number(j.stock).toLocaleString("en-US")}</td>
                  <td className="p-3 text-right tabular-nums">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(Number(j.price || 0))}
                  </td>
                  <td className="p-3">{fmtDateTimeUtc(j.createdAt)}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={6}>
                  No products found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Page {getPage.toLocaleString("en-US")} of {totalPages.toLocaleString("en-US")}
        </div>
      </div>

      <div>
        <MerchantSubpagePagination currentPage={getPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
