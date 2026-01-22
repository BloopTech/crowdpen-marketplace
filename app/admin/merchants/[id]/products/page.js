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
    <div className="space-y-4 pb-8" data-testid="admin-merchant-products">
      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4"
        data-testid="admin-merchant-products-summary"
      >
        <div className="text-base font-semibold" data-testid="admin-merchant-products-title">
          Products
        </div>
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-products-count">
          Showing {rows.length.toLocaleString("en-US")} of {Number(count || 0).toLocaleString("en-US")}
        </div>
      </div>

      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-x-auto"
        data-testid="admin-merchant-products-table-card"
      >
        <table className="w-full text-sm" data-testid="admin-merchant-products-table">
          <thead data-testid="admin-merchant-products-head">
            <tr className="border-b" data-testid="admin-merchant-products-head-row">
              <th className="text-left p-3" data-testid="admin-merchant-products-head-title">
                Title
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-products-head-status">
                Status
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-products-head-flagged">
                Flagged
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-products-head-stock">
                Stock
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-products-head-price">
                Price (USD)
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-products-head-created">
                Created
              </th>
            </tr>
          </thead>
          <tbody data-testid="admin-merchant-products-body">
            {rows.map((p) => {
              const j = p.toJSON();
              return (
                <tr
                  key={j.id}
                  className="border-b last:border-0"
                  data-testid={`admin-merchant-products-row-${j.id}`}
                >
                  <td className="p-3" data-testid={`admin-merchant-products-row-${j.id}-title`}>
                    <div
                      className="font-medium"
                      data-testid={`admin-merchant-products-row-${j.id}-title-text`}
                    >
                      {j.title}
                    </div>
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid={`admin-merchant-products-row-${j.id}-product-id`}
                    >
                      {j.product_id}
                    </div>
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid={`admin-merchant-products-row-${j.id}-link`}
                    >
                      <Link
                        href="/admin/products"
                        className="underline text-primary"
                        data-testid={`admin-merchant-products-row-${j.id}-open-products`}
                      >
                        Open in Products
                      </Link>
                    </div>
                  </td>
                  <td
                    className="p-3 capitalize"
                    data-testid={`admin-merchant-products-row-${j.id}-status`}
                  >
                    {j.product_status}
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-products-row-${j.id}-flagged`}
                  >
                    {j.flagged ? "Yes" : "No"}
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-products-row-${j.id}-stock`}
                  >
                    {j.stock == null ? "-" : Number(j.stock).toLocaleString("en-US")}
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-products-row-${j.id}-price`}
                  >
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(Number(j.price || 0))}
                  </td>
                  <td
                    className="p-3"
                    data-testid={`admin-merchant-products-row-${j.id}-created`}
                  >
                    {fmtDateTimeUtc(j.createdAt)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr data-testid="admin-merchant-products-empty">
                <td
                  className="p-6 text-center text-muted-foreground"
                  colSpan={6}
                  data-testid="admin-merchant-products-empty-cell"
                >
                  No products found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" data-testid="admin-merchant-products-page">
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-products-page-info">
          Page {getPage.toLocaleString("en-US")} of {totalPages.toLocaleString("en-US")}
        </div>
      </div>

      <div data-testid="admin-merchant-products-pagination">
        <MerchantSubpagePagination currentPage={getPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
