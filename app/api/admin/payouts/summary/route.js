import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function parseDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function parseDateEndUtc(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999));
    if (!Number.isFinite(dt.getTime())) return null;
    return dt;
  }
  return parseDateSafe(s);
}

function settlementKey(fromDate, toDate) {
  const fromKey = fromDate.toISOString().slice(0, 10);
  const toKey = toDate.toISOString().slice(0, 10);
  return `settlement:${fromKey}:${toKey}`;
}

export const runtime = "nodejs";

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const recipientId = String(
      searchParams.get("recipientId") || searchParams.get("recipient_id") || ""
    ).trim();
    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    if (!recipientId) {
      return NextResponse.json(
        { status: "error", message: "recipientId is required" },
        { status: 400 }
      );
    }

    const fromDate = parseDateSafe(fromParam);
    const toDate = parseDateEndUtc(toParam);

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { status: "error", message: "from and to are required" },
        { status: 400 }
      );
    }

    const key = settlementKey(fromDate, toDate);

    const rows = await db.sequelize.query(
      `
        WITH tx AS (
          SELECT t.id, t.amount, t.status
          FROM public.marketplace_admin_transactions t
          WHERE t.trans_type = 'payout'
            AND t.recipient_id = :recipientId
            AND (
              t.transaction_id = :key
              OR (
                t.transaction_id IS NULL
                AND t."createdAt" >= :from
                AND t."createdAt" <= :to
              )
            )
        )
        SELECT
          tx.id,
          tx.amount,
          tx.status,
          COUNT(le.id)::bigint AS ledger_rows,
          COALESCE(SUM(le.amount_cents), 0)::bigint AS ledger_sum_cents
        FROM tx
        LEFT JOIN public.marketplace_earnings_ledger_entries le
          ON le.marketplace_admin_transaction_id = tx.id
          AND le.entry_type IN ('payout_debit','payout_debit_reversal')
        GROUP BY tx.id, tx.amount, tx.status
      `,
      {
        replacements: {
          recipientId,
          key,
          from: fromDate,
          to: toDate,
        },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let completedCents = 0;
    let pendingCents = 0;
    let otherCents = 0;

    for (const r of rows || []) {
      const status = String(r?.status || "").toLowerCase();
      const hasLedger = Number(r?.ledger_rows || 0) > 0;
      const ledgerSumCents = Number(r?.ledger_sum_cents || 0) || 0;
      const fallbackAmountCents = Number(r?.amount || 0) || 0;
      const paidCents = hasLedger
        ? Math.max(0, -ledgerSumCents)
        : Math.max(0, fallbackAmountCents);

      if (status === "completed") completedCents += paidCents;
      else if (status === "pending") pendingCents += paidCents;
      else otherCents += paidCents;
    }

    const toMajor = (cents) => (Number(cents || 0) || 0) / 100;

    return NextResponse.json({
      status: "success",
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
      data: {
        recipientId,
        settlementKey: key,
        payouts: {
          completed: toMajor(completedCents),
          pending: toMajor(pendingCents),
          other: toMajor(otherCents),
          total: toMajor(completedCents + pendingCents + otherCents),
        },
      },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_payouts_summary_get",
      route: "/api/admin/payouts/summary",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
