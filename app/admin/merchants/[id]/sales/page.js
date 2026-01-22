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

export default async function AdminMerchantSalesPage({ params, searchParams }) {
  const { id } = await params;
  const merchantId = id;
  const { page, pageSize } = await searchParams;

  const getPage = Math.max(1, Number(page || 1) || 1);
  const getPageSize = Math.min(100, Math.max(1, Number(pageSize || 20) || 20));
  const offset = (getPage - 1) * getPageSize;

  const sql =
    'SELECT\n'
    + '  oi."id" AS "orderItemId",\n'
    + '  oi."quantity" AS "quantity",\n'
    + '  (oi."subtotal")::numeric AS "subtotal",\n'
    + '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",\n'
    + '  o."id" AS "orderId",\n'
    + '  o."order_number" AS "orderNumber",\n'
    + '  o."createdAt" AS "createdAt",\n'
    + '  o."paymentStatus" AS "paymentStatus",\n'
    + '  o."couponCode" AS "couponCode",\n'
    + '  buyer."id" AS "buyerId",\n'
    + '  buyer."name" AS "buyerName",\n'
    + '  buyer."email" AS "buyerEmail",\n'
    + '  p."id" AS "productId",\n'
    + '  p."title" AS "productTitle"\n'
    + 'FROM "marketplace_products" AS p\n'
    + 'JOIN "marketplace_order_items" AS oi ON oi."marketplace_product_id" = p."id"\n'
    + 'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n'
    + 'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n'
    + 'LEFT JOIN "users" AS buyer ON buyer."id" = o."user_id"\n'
    + 'WHERE p."user_id" = :merchantId\n'
    + '  AND o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n'
    + 'GROUP BY oi."id", o."id", buyer."id", p."id"\n'
    + 'ORDER BY o."createdAt" DESC\n'
    + 'LIMIT :limit OFFSET :offset\n';

  const rows = await db.sequelize.query(sql, {
    replacements: { merchantId, limit: getPageSize, offset },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const countSql =
    'SELECT COUNT(*)::int AS count\n'
    + 'FROM "marketplace_products" AS p\n'
    + 'JOIN "marketplace_order_items" AS oi ON oi."marketplace_product_id" = p."id"\n'
    + 'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n'
    + 'WHERE p."user_id" = :merchantId\n'
    + '  AND o."paymentStatus" = \'successful\'::"enum_marketplace_orders_paymentStatus"\n';

  const [countRow] = await db.sequelize.query(countSql, {
    replacements: { merchantId },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const total = Number(countRow?.count || 0) || 0;
  const totalPages = Math.max(1, Math.ceil(total / getPageSize));

  return (
    <div className="space-y-4 pb-8" data-testid="admin-merchant-sales">
      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4"
        data-testid="admin-merchant-sales-summary"
      >
        <div className="text-base font-semibold" data-testid="admin-merchant-sales-title">
          Sales
        </div>
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-sales-description">
          Paid order items for this merchant (USD).
        </div>
      </div>

      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-x-auto"
        data-testid="admin-merchant-sales-table-card"
      >
        <table className="w-full text-sm" data-testid="admin-merchant-sales-table">
          <thead data-testid="admin-merchant-sales-head">
            <tr className="border-b" data-testid="admin-merchant-sales-head-row">
              <th className="text-left p-3" data-testid="admin-merchant-sales-head-date">
                Date
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-sales-head-product">
                Product
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-sales-head-buyer">
                Buyer
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-sales-head-order">
                Order
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-sales-head-qty">
                Qty
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-sales-head-subtotal">
                Subtotal (USD)
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-sales-head-discount">
                Discount (USD)
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-sales-head-paid">
                Buyer Paid (USD)
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-sales-head-coupon">
                Coupon
              </th>
            </tr>
          </thead>
          <tbody data-testid="admin-merchant-sales-body">
            {(rows || []).map((r) => (
              <tr
                key={r.orderItemId}
                className="border-b last:border-0"
                data-testid={`admin-merchant-sales-row-${r.orderItemId}`}
              >
                <td className="p-3" data-testid={`admin-merchant-sales-row-${r.orderItemId}-date`}>
                  {fmtDateTimeUtc(r.createdAt)}
                </td>
                <td className="p-3" data-testid={`admin-merchant-sales-row-${r.orderItemId}-product`}>
                  <div
                    className="font-medium"
                    data-testid={`admin-merchant-sales-row-${r.orderItemId}-product-title`}
                  >
                    {r.productTitle}
                  </div>
                  <div
                    className="text-xs text-muted-foreground"
                    data-testid={`admin-merchant-sales-row-${r.orderItemId}-product-id`}
                  >
                    {r.productId}
                  </div>
                </td>
                <td className="p-3" data-testid={`admin-merchant-sales-row-${r.orderItemId}-buyer`}>
                  <div
                    className="font-medium"
                    data-testid={`admin-merchant-sales-row-${r.orderItemId}-buyer-name`}
                  >
                    {r.buyerName || r.buyerEmail || r.buyerId || "-"}
                  </div>
                  <div
                    className="text-xs text-muted-foreground"
                    data-testid={`admin-merchant-sales-row-${r.orderItemId}-buyer-email`}
                  >
                    {r.buyerEmail || ""}
                  </div>
                </td>
                <td className="p-3" data-testid={`admin-merchant-sales-row-${r.orderItemId}-order`}>
                  <div
                    className="font-medium"
                    data-testid={`admin-merchant-sales-row-${r.orderItemId}-order-number`}
                  >
                    {r.orderNumber || r.orderId}
                  </div>
                  <div
                    className="text-xs text-muted-foreground capitalize"
                    data-testid={`admin-merchant-sales-row-${r.orderItemId}-payment-status`}
                  >
                    {r.paymentStatus}
                  </div>
                </td>
                <td
                  className="p-3 text-right tabular-nums"
                  data-testid={`admin-merchant-sales-row-${r.orderItemId}-qty`}
                >
                  {Number(r.quantity || 0).toLocaleString("en-US")}
                </td>
                <td
                  className="p-3 text-right tabular-nums"
                  data-testid={`admin-merchant-sales-row-${r.orderItemId}-subtotal`}
                >
                  {fmtUsd(r.subtotal)}
                </td>
                <td
                  className="p-3 text-right tabular-nums"
                  data-testid={`admin-merchant-sales-row-${r.orderItemId}-discount`}
                >
                  {fmtUsd(r.discountTotal)}
                </td>
                <td
                  className="p-3 text-right tabular-nums"
                  data-testid={`admin-merchant-sales-row-${r.orderItemId}-paid`}
                >
                  {fmtUsd(
                    Math.max(
                      0,
                      (Number(r.subtotal || 0) || 0) - (Number(r.discountTotal || 0) || 0)
                    )
                  )}
                </td>
                <td className="p-3" data-testid={`admin-merchant-sales-row-${r.orderItemId}-coupon`}>
                  {r.couponCode || "-"}
                </td>
              </tr>
            ))}
            {(rows || []).length === 0 ? (
              <tr data-testid="admin-merchant-sales-empty">
                <td
                  className="p-6 text-center text-muted-foreground"
                  colSpan={9}
                  data-testid="admin-merchant-sales-empty-cell"
                >
                  No sales found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" data-testid="admin-merchant-sales-page">
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-sales-page-info">
          Page {getPage.toLocaleString("en-US")} of {totalPages.toLocaleString("en-US")} ({total.toLocaleString("en-US")} rows)
        </div>
      </div>

      <div data-testid="admin-merchant-sales-pagination">
        <MerchantSubpagePagination currentPage={getPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
