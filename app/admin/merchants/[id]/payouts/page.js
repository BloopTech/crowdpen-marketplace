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

export default async function AdminMerchantPayoutsPage({
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
    '  t."status" AS "status",\n' +
    '  t."amount" AS "amountCents",\n' +
    '  t."currency" AS "currency",\n' +
    '  t."transaction_reference" AS "reference",\n' +
    '  t."createdAt" AS "createdAt",\n' +
    '  pp."settlement_from" AS "settlementFrom",\n' +
    '  pp."settlement_to" AS "settlementTo"\n' +
    'FROM "marketplace_admin_transactions" AS t\n' +
    'LEFT JOIN "marketplace_payout_periods" AS pp\n' +
    '  ON pp."marketplace_admin_transaction_id" = t."id"\n' +
    "WHERE t.\"trans_type\" = 'payout'\n" +
    '  AND t."recipient_id" = :merchantId\n' +
    'ORDER BY t."createdAt" DESC\n' +
    "LIMIT :limit OFFSET :offset\n";

  const rows = await db.sequelize.query(sql, {
    replacements: { merchantId, limit: getPageSize, offset },
    type: db.Sequelize.QueryTypes.SELECT,
  });

  const countSql =
    "SELECT COUNT(*)::int AS count\n" +
    'FROM "marketplace_admin_transactions" AS t\n' +
    "WHERE t.\"trans_type\" = 'payout'\n" +
    '  AND t."recipient_id" = :merchantId\n';

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
    <div className="space-y-4 pb-8" data-testid="admin-merchant-payouts">
      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4"
        data-testid="admin-merchant-payouts-summary"
      >
        <div className="text-base font-semibold" data-testid="admin-merchant-payouts-title">
          Payouts
        </div>
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-payouts-description">
          All payouts for this merchant (USD).
        </div>
      </div>

      <div
        className="rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-x-auto"
        data-testid="admin-merchant-payouts-table-card"
      >
        <table className="w-full text-sm" data-testid="admin-merchant-payouts-table">
          <thead data-testid="admin-merchant-payouts-head">
            <tr className="border-b" data-testid="admin-merchant-payouts-head-row">
              <th className="text-left p-3" data-testid="admin-merchant-payouts-head-date">
                Date
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-payouts-head-status">
                Status
              </th>
              <th className="text-right p-3" data-testid="admin-merchant-payouts-head-amount">
                Amount (USD)
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-payouts-head-settlement">
                Settlement Window
              </th>
              <th className="text-left p-3" data-testid="admin-merchant-payouts-head-reference">
                Reference
              </th>
            </tr>
          </thead>
          <tbody data-testid="admin-merchant-payouts-body">
            {(rows || []).map((r) => {
              const amount = fmtUsd(toMajor(r.amountCents));
              const window =
                r.settlementFrom && r.settlementTo
                  ? `${r.settlementFrom} → ${r.settlementTo}`
                  : "-";
              return (
                <tr
                  key={r.id}
                  className="border-b last:border-0"
                  data-testid={`admin-merchant-payouts-row-${r.id}`}
                >
                  <td className="p-3" data-testid={`admin-merchant-payouts-row-${r.id}-date`}>
                    {fmtDateTimeUtc(r.createdAt)}
                  </td>
                  <td className="p-3 capitalize" data-testid={`admin-merchant-payouts-row-${r.id}-status`}>
                    {r.status}
                  </td>
                  <td
                    className="p-3 text-right tabular-nums"
                    data-testid={`admin-merchant-payouts-row-${r.id}-amount`}
                  >
                    {amount}
                  </td>
                  <td className="p-3" data-testid={`admin-merchant-payouts-row-${r.id}-settlement`}>
                    {window}
                  </td>
                  <td className="p-3" data-testid={`admin-merchant-payouts-row-${r.id}-reference`}>
                    {r.reference || "-"}
                  </td>
                </tr>
              );
            })}
            {(rows || []).length === 0 ? (
              <tr data-testid="admin-merchant-payouts-empty">
                <td
                  className="p-6 text-center text-muted-foreground"
                  colSpan={5}
                  data-testid="admin-merchant-payouts-empty-cell"
                >
                  No payouts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" data-testid="admin-merchant-payouts-page">
        <div className="text-xs text-muted-foreground" data-testid="admin-merchant-payouts-page-info">
          Page {getPage.toLocaleString("en-US")} of {totalPages.toLocaleString("en-US")} ({total.toLocaleString("en-US")} payouts)
        </div>
      </div>

      <div data-testid="admin-merchant-payouts-pagination">
        <MerchantSubpagePagination currentPage={getPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
