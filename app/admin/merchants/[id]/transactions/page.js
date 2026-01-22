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

export default async function AdminMerchantTransactionsPage({
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
    '  t."id" AS "id",\n' +
    '  t."trans_type" AS "type",\n' +
    '  t."status" AS "status",\n' +
    '  t."amount" AS "amountCents",\n' +
    '  t."currency" AS "currency",\n' +
    '  t."transaction_reference" AS "reference",\n' +
    '  t."createdAt" AS "createdAt"\n' +
    'FROM "marketplace_admin_transactions" AS t\n' +
    'WHERE t."recipient_id" = :merchantId\n' +
    'ORDER BY t."createdAt" DESC\n' +
    "LIMIT :limit OFFSET :offset\n";

  const rows = await db.sequelize.query(sql, {
    replacements: { merchantId, limit: getPageSize, offset },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const countSql =
    "SELECT COUNT(*)::int AS count\n" +
    'FROM "marketplace_admin_transactions" AS t\n' +
    'WHERE t."recipient_id" = :merchantId\n';

  const [countRow] = await db.sequelize.query(countSql, {
    replacements: { merchantId },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const total = Number(countRow?.count || 0) || 0;
  const totalPages = Math.max(1, Math.ceil(total / getPageSize));

  const toMajor = (n) => {
    const v = n != null ? Number(n) : NaN;
    if (!Number.isFinite(v)) return 0;
    return v / 100;
  };

  return (
    <div className="space-y-4 pb-8" data-testid="admin-merchant-transactions">
      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4"
        data-testid="admin-merchant-transactions-summary"
      >
        <div className="text-base font-semibold" data-testid="admin-merchant-transactions-title">
          Transactions
        </div>
        <div
          className="text-xs text-muted-foreground"
          data-testid="admin-merchant-transactions-description"
        >
          All admin transactions for this merchant (USD).
        </div>
      </div>

      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-x-auto"
        data-testid="admin-merchant-transactions-table-card"
      >
        <table className="w-full text-sm" data-testid="admin-merchant-transactions-table">
          <thead data-testid="admin-merchant-transactions-head">
            <tr className="border-b" data-testid="admin-merchant-transactions-head-row">
              <th className="text-left p-3" data-testid="admin-merchant-transactions-head-date">
                Date
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-transactions-head-type">
                Type
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-transactions-head-status">
                Status
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-transactions-head-amount">
                Amount (USD)
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-transactions-head-reference">
                Reference
              </th>
            </tr>
          </thead>
          <tbody data-testid="admin-merchant-transactions-body">
            {(rows || []).map((r) => (
              <tr
                key={r.id}
                className="border-b last:border-0"
                data-testid={`admin-merchant-transactions-row-${r.id}`}
              >
                <td className="p-3" data-testid={`admin-merchant-transactions-row-${r.id}-date`}>
                  {fmtDateTimeUtc(r.createdAt)}
                </td>
                <td className="p-3 capitalize" data-testid={`admin-merchant-transactions-row-${r.id}-type`}>
                  {r.type}
                </td>
                <td className="p-3 capitalize" data-testid={`admin-merchant-transactions-row-${r.id}-status`}>
                  {r.status}
                </td>
                <td
                  className="p-3 text-right tabular-nums"
                  data-testid={`admin-merchant-transactions-row-${r.id}-amount`}
                >
                  {fmtUsd(toMajor(r.amountCents))}
                </td>
                <td className="p-3" data-testid={`admin-merchant-transactions-row-${r.id}-reference`}>
                  {r.reference || "-"}
                </td>
              </tr>
            ))}
            {(rows || []).length === 0 ? (
              <tr data-testid="admin-merchant-transactions-empty">
                <td
                  className="p-6 text-center text-muted-foreground"
                  colSpan={5}
                  data-testid="admin-merchant-transactions-empty-cell"
                >
                  No transactions found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" data-testid="admin-merchant-transactions-page">
        <div
          className="text-xs text-muted-foreground"
          data-testid="admin-merchant-transactions-page-info"
        >
          Page {getPage.toLocaleString("en-US")} of {totalPages.toLocaleString("en-US")} ({total.toLocaleString("en-US")} rows)
        </div>
      </div>

      <div data-testid="admin-merchant-transactions-pagination">
        <MerchantSubpagePagination currentPage={getPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
