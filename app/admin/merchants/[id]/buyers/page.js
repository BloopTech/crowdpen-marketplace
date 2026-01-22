"use server";
import React from "react";
import { db } from "../../../../models/index";
import MerchantSubpagePagination from "../MerchantSubpagePagination";

function fmtUsd(v) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v || 0));
}

function fmtDateTimeUtc(v) {
  const d = v ? new Date(v) : null;
  if (!d || !Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("en-US", { timeZone: "UTC" });
}

export default async function AdminMerchantBuyersPage({
  params,
  searchParams,
}) {
  const { id } = await params;
  const merchantId = id;
  const { page, pageSize } = await searchParams;

  const getPage = Math.max(1, Number(page || 1) || 1);
  const getPageSize = Math.min(100, Math.max(1, Number(pageSize || 20) || 20));
  const offset = (getPage - 1) * getPageSize;

  const sql =
    "SELECT\n" +
    '  o."user_id" AS "buyerId",\n' +
    '  buyer."name" AS "buyerName",\n' +
    '  buyer."email" AS "buyerEmail",\n' +
    '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue",\n' +
    '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",\n' +
    '  COALESCE(SUM(oi."quantity"), 0) AS "units",\n' +
    '  COUNT(DISTINCT o."id")::int AS "orders",\n' +
    '  MAX(o."createdAt") AS "lastPurchaseAt"\n' +
    'FROM "marketplace_products" AS p\n' +
    'JOIN "marketplace_order_items" AS oi ON oi."marketplace_product_id" = p."id"\n' +
    'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n' +
    'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n' +
    'LEFT JOIN "users" AS buyer ON buyer."id" = o."user_id"\n' +
    'WHERE p."user_id" = :merchantId\n' +
    '  AND o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n' +
    'GROUP BY o."user_id", buyer."id"\n' +
    'ORDER BY "revenue" DESC\n' +
    "LIMIT :limit OFFSET :offset\n";

  const rows = await db.sequelize.query(sql, {
    replacements: { merchantId, limit: getPageSize, offset },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const countSql =
    "SELECT COUNT(*)::int AS count\n" +
    "FROM (\n" +
    '  SELECT o."user_id"\n' +
    '  FROM "marketplace_products" AS p\n' +
    '  JOIN "marketplace_order_items" AS oi ON oi."marketplace_product_id" = p."id"\n' +
    '  JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n' +
    '  WHERE p."user_id" = :merchantId\n' +
    '    AND o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n' +
    '  GROUP BY o."user_id"\n' +
    ") AS t\n";

  const [countRow] = await db.sequelize.query(countSql, {
    replacements: { merchantId },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const total = Number(countRow?.count || 0) || 0;
  const totalPages = Math.max(1, Math.ceil(total / getPageSize));
  return (
    <div className="space-y-4 pb-8" data-testid="admin-merchant-buyers">
      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4"
        data-testid="admin-merchant-buyers-summary"
      >
        <div className="text-base font-semibold" data-testid="admin-merchant-buyers-title">
          Buyers
        </div>
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-buyers-description">
          Top buyers for this merchant (USD).
        </div>
      </div>

      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-x-auto"
        data-testid="admin-merchant-buyers-table-card"
      >
        <table className="w-full text-sm" data-testid="admin-merchant-buyers-table">
          <thead data-testid="admin-merchant-buyers-head">
            <tr className="border-b" data-testid="admin-merchant-buyers-head-row">
              <th className="text-left p-3" data-testid="admin-merchant-buyers-head-buyer">
                Buyer
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-buyers-head-paid">
                Buyer Paid (USD)
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-buyers-head-discount">
                Coupon Discounts
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-buyers-head-units">
                Units
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-buyers-head-orders">
                Orders
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-buyers-head-last-purchase">
                Last Purchase
              </th>
            </tr>
          </thead>
          <tbody data-testid="admin-merchant-buyers-body">
            {(rows || []).map((r) => {
              const rowId = r.buyerId || "unknown";
              return (
                <tr
                  key={r.buyerId}
                  className="border-b last:border-0"
                  data-testid={`admin-merchant-buyers-row-${rowId}`}
                >
                  <td className="p-3" data-testid={`admin-merchant-buyers-row-${rowId}-buyer`}>
                    <div
                      className="font-medium"
                      data-testid={`admin-merchant-buyers-row-${rowId}-buyer-name`}
                    >
                      {r.buyerName || r.buyerEmail || r.buyerId || "-"}
                    </div>
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid={`admin-merchant-buyers-row-${rowId}-buyer-email`}
                    >
                      {r.buyerEmail || ""}
                    </div>
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-buyers-row-${rowId}-paid`}
                  >
                    {fmtUsd(
                      Math.max(
                        0,
                        (Number(r.revenue || 0) || 0) - (Number(r.discountTotal || 0) || 0)
                      )
                    )}
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-buyers-row-${rowId}-discount`}
                  >
                    {fmtUsd(Number(r.discountTotal || 0) || 0)}
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-buyers-row-${rowId}-units`}
                  >
                    {Number(r.units || 0).toLocaleString("en-US")}
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-buyers-row-${rowId}-orders`}
                  >
                    {Number(r.orders || 0).toLocaleString("en-US")}
                  </td>
                  <td
                    className="p-3"
                    data-testid={`admin-merchant-buyers-row-${rowId}-last-purchase`}
                  >
                    {fmtDateTimeUtc(r.lastPurchaseAt)}
                  </td>
                </tr>
              );
            })}
            {(rows || []).length === 0 ? (
              <tr data-testid="admin-merchant-buyers-empty">
                <td
                  className="p-6 text-center text-muted-foreground"
                  colSpan={6}
                  data-testid="admin-merchant-buyers-empty-cell"
                >
                  No buyers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" data-testid="admin-merchant-buyers-page">
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-buyers-page-info">
          Page {getPage.toLocaleString("en-US")} of {totalPages.toLocaleString("en-US")} ({total.toLocaleString("en-US")} buyers)
        </div>
      </div>

      <div data-testid="admin-merchant-buyers-pagination">
        <MerchantSubpagePagination currentPage={getPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
