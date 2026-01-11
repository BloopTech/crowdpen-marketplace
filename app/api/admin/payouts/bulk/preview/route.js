import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { db } from "../../../../../models/index";
import { getRequestIdFromHeaders, reportError } from "../../../../../lib/observability/reportError";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function isoDay(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseIsoDateOnly(s) {
  const v = String(s || "").trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  if (!Number.isFinite(dt.getTime())) return null;
  return dt;
}

function clampInt(v, min, max) {
  const n = Number.parseInt(String(v || ""), 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
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
    const modeRaw = String(searchParams.get("mode") || "settle_all").trim();
    const mode = modeRaw === "cutoff" ? "cutoff" : "settle_all";
    const cutoffToParam = String(searchParams.get("cutoffTo") || "").trim();
    const merchantIdsParam = String(searchParams.get("merchantIds") || "").trim();
    const cursor = String(searchParams.get("cursor") || "").trim();
    const limitParam = searchParams.get("limit");

    const todayIso = new Date().toISOString().slice(0, 10);

    let runMaxToIso = todayIso;
    if (mode === "cutoff") {
      const cutoffDt = parseIsoDateOnly(cutoffToParam);
      if (!cutoffDt) {
        return NextResponse.json(
          { status: "error", message: "cutoffTo is required" },
          { status: 400 }
        );
      }
      const cutoffIso = cutoffDt.toISOString().slice(0, 10);
      runMaxToIso = cutoffIso < todayIso ? cutoffIso : todayIso;
    }

    const merchantIds = merchantIdsParam
      ? merchantIdsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const defaultLimitRaw = process.env.BULK_PAYOUT_BATCH_SIZE || "10";
    const maxLimitRaw = process.env.BULK_PAYOUT_MAX_BATCH_SIZE || "25";
    const maxLimit = clampInt(maxLimitRaw, 1, 200);
    const limit = clampInt(limitParam || defaultLimitRaw, 1, maxLimit);

    const whereMerchants = merchantIds.length ? "AND u.id IN (:merchantIds)" : "";
    const whereCursor = cursor ? "AND u.id > :cursor" : "";

    const merchantBatch = await db.sequelize.query(
      `
        SELECT u.id
        FROM public.users u
        WHERE u.merchant = TRUE
        ${whereMerchants}
        ${whereCursor}
        ORDER BY u.id
        LIMIT :limitPlusOne
      `,
      {
        replacements: {
          merchantIds,
          cursor,
          limitPlusOne: limit + 1,
        },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const batchIdsAll = (merchantBatch || []).map((r) => r.id).filter(Boolean);
    const hasMore = batchIdsAll.length > limit;
    const batchIds = batchIdsAll.slice(0, limit);
    const nextCursor = hasMore && batchIds.length ? batchIds[batchIds.length - 1] : null;

    if (!batchIds.length) {
      return NextResponse.json({
        status: "success",
        data: {
          mode,
          runMaxTo: runMaxToIso,
          today: todayIso,
          cursor: cursor || null,
          nextCursor,
          hasMore,
          limit,
          count: 0,
          rows: [],
        },
      });
    }

    const rows = await db.sequelize.query(
      `
        WITH merchants AS (
          SELECT u.id, u.name, u.email
          FROM public.users u
          WHERE u.merchant = TRUE
            AND u.id IN (:batchIds)
        ), last_settled AS (
          SELECT recipient_id, MAX(settlement_to) AS last_settled_to
          FROM public.marketplace_payout_periods
          WHERE is_active = TRUE
          GROUP BY recipient_id
        ), eligible AS (
          SELECT
            m.id AS merchant_id,
            m.name,
            m.email,
            ls.last_settled_to,
            MIN(e.earned_at)::date AS eligible_from,
            MAX(e.earned_at)::date AS last_unsettled
          FROM merchants m
          JOIN public.marketplace_earnings_ledger_entries e
            ON e.recipient_id = m.id
            AND e.entry_type = 'sale_credit'
          LEFT JOIN last_settled ls ON ls.recipient_id = m.id
          WHERE (ls.last_settled_to IS NULL OR (e.earned_at::date > ls.last_settled_to))
          GROUP BY m.id, m.name, m.email, ls.last_settled_to
        ), window AS (
          SELECT
            e.merchant_id,
            e.name,
            e.email,
            e.last_settled_to,
            e.eligible_from,
            LEAST(:runMaxTo::date, e.last_unsettled) AS eligible_to
          FROM eligible e
        ), credits AS (
          SELECT
            w.merchant_id,
            COALESCE(SUM(e.amount_cents), 0)::bigint AS expected_cents
          FROM window w
          JOIN public.marketplace_earnings_ledger_entries e
            ON e.recipient_id = w.merchant_id
            AND e.entry_type = 'sale_credit'
            AND e.earned_at::date >= w.eligible_from
            AND e.earned_at::date <= w.eligible_to
            AND (w.last_settled_to IS NULL OR (e.earned_at::date > w.last_settled_to))
          GROUP BY w.merchant_id
        )
        SELECT
          w.merchant_id AS "merchantId",
          w.name AS "merchantName",
          w.email AS "merchantEmail",
          w.last_settled_to AS "lastSettledTo",
          w.eligible_from AS "eligibleFrom",
          w.eligible_to AS "eligibleTo",
          COALESCE(c.expected_cents, 0)::bigint AS "expectedCents"
        FROM window w
        LEFT JOIN credits c ON c.merchant_id = w.merchant_id
        ORDER BY w.name NULLS LAST, w.email
      `,
      {
        replacements: {
          runMaxTo: runMaxToIso,
          batchIds,
        },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const periods = (rows || [])
      .map((r) => {
        const from = isoDay(r?.eligibleFrom);
        const to = isoDay(r?.eligibleTo);
        if (!from || !to || from > to) return null;
        const expectedCents = Number(r?.expectedCents || 0) || 0;
        return {
          merchantId: r.merchantId,
          merchantName: r.merchantName || r.merchantEmail || r.merchantId,
          merchantEmail: r.merchantEmail,
          from,
          to,
          expectedCents,
        };
      })
      .filter(Boolean);

    const paidByMerchant = new Map();
    if (periods.length) {
      const merchantIds = periods.map((p) => p.merchantId);
      const froms = periods.map((p) => p.from);
      const tos = periods.map((p) => p.to);

      const paidRows = await db.sequelize.query(
        `
          WITH periods AS (
            SELECT *
            FROM unnest(:merchantIds::uuid[], :froms::date[], :tos::date[])
              AS p(merchant_id, from_day, to_day)
          ), per_tx AS (
            SELECT
              p.merchant_id,
              pp.marketplace_admin_transaction_id AS tx_id
            FROM periods p
            JOIN public.marketplace_payout_periods pp
              ON pp.recipient_id = p.merchant_id
              AND pp.is_active = TRUE
              AND pp.settlement_from = p.from_day
              AND pp.settlement_to = p.to_day
          )
          SELECT
            p.merchant_id AS "merchantId",
            COALESCE(SUM(
              CASE
                WHEN le.id IS NULL THEN 0
                ELSE GREATEST(0, -le.amount_cents)
              END
            ), 0)::bigint AS "paidCents"
          FROM periods p
          LEFT JOIN per_tx pt ON pt.merchant_id = p.merchant_id
          LEFT JOIN public.marketplace_earnings_ledger_entries le
            ON le.marketplace_admin_transaction_id = pt.tx_id
            AND le.entry_type IN ('payout_debit','payout_debit_reversal')
          GROUP BY p.merchant_id
        `,
        {
          replacements: { merchantIds, froms, tos },
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      for (const pr of paidRows || []) {
        paidByMerchant.set(pr.merchantId, Number(pr?.paidCents || 0) || 0);
      }
    }

    const data = periods
      .map((p) => {
        const alreadyPaidCents = paidByMerchant.get(p.merchantId) || 0;
        const remainingCents = Math.max(0, (p.expectedCents || 0) - alreadyPaidCents);
        const remaining = remainingCents / 100;
        return {
          merchantId: p.merchantId,
          merchantName: p.merchantName,
          merchantEmail: p.merchantEmail,
          from: p.from,
          to: p.to,
          currency: "USD",
          alreadyPaid: Number((alreadyPaidCents / 100).toFixed(2)),
          remaining: Number(remaining.toFixed(2)),
        };
      })
      .filter((r) => r.remaining > 0);

    return NextResponse.json({
      status: "success",
      data: {
        mode,
        runMaxTo: runMaxToIso,
        today: todayIso,
        cursor: cursor || null,
        nextCursor,
        hasMore,
        limit,
        count: data.length,
        rows: data,
      },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_payouts_bulk_preview_get",
      route: "/api/admin/payouts/bulk/preview",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : error?.message || "Failed" },
      { status: 500 }
    );
  }
}
