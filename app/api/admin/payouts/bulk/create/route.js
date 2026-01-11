import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { db } from "../../../../../models/index";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../../lib/security/rateLimit";
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

async function computePreview({ merchantIds, mode, cutoffTo, cursor, limit }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  let runMaxToIso = todayIso;
  if (mode === "cutoff") {
    const cutoffDt = parseIsoDateOnly(cutoffTo);
    if (!cutoffDt) {
      throw new Error("cutoffTo is required");
    }
    const cutoffIso = cutoffDt.toISOString().slice(0, 10);
    runMaxToIso = cutoffIso < todayIso ? cutoffIso : todayIso;
  }

  const defaultLimitRaw = process.env.BULK_PAYOUT_BATCH_SIZE || "10";
  const maxLimitRaw = process.env.BULK_PAYOUT_MAX_BATCH_SIZE || "25";
  const maxLimit = clampInt(maxLimitRaw, 1, 200);
  const finalLimit = clampInt(limit || defaultLimitRaw, 1, maxLimit);

  const whereMerchants = merchantIds?.length ? "AND u.id IN (:merchantIds)" : "";
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
        merchantIds: merchantIds?.length ? merchantIds : [],
        cursor,
        limitPlusOne: finalLimit + 1,
      },
      type: db.Sequelize.QueryTypes.SELECT,
    }
  );

  const batchIdsAll = (merchantBatch || []).map((r) => r.id).filter(Boolean);
  const hasMore = batchIdsAll.length > finalLimit;
  const batchIds = batchIdsAll.slice(0, finalLimit);
  const nextCursor = hasMore && batchIds.length ? batchIds[batchIds.length - 1] : null;

  if (!batchIds.length) {
    return { todayIso, runMaxToIso, cursor: cursor || null, nextCursor, hasMore, limit: finalLimit, rows: [] };
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
    const mIds = periods.map((p) => p.merchantId);
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
        replacements: { merchantIds: mIds, froms, tos },
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
      return {
        merchantId: p.merchantId,
        merchantName: p.merchantName,
        merchantEmail: p.merchantEmail,
        from: p.from,
        to: p.to,
        remainingCents,
      };
    })
    .filter((r) => r.remainingCents > 0);

  return {
    todayIso,
    runMaxToIso,
    cursor: cursor || null,
    nextCursor,
    hasMore,
    limit: finalLimit,
    rows: data,
  };
}

export const runtime = "nodejs";

export async function POST(request) {
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

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-payouts:bulk-create:${userIdForRl}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = (await request.json().catch(() => null)) || {};
    const modeRaw = String(body.mode || "settle_all").trim();
    const mode = modeRaw === "cutoff" ? "cutoff" : "settle_all";
    const cutoffTo = String(body.cutoffTo || "").trim();
    const cursor = body.cursor != null ? String(body.cursor).trim() : "";
    const limit = body.limit != null ? body.limit : null;
    const note = body.note != null ? String(body.note).trim() : null;
    const transaction_reference =
      body.transaction_reference != null ? String(body.transaction_reference).trim() : null;

    const payoutProviderRaw = body.payout_provider != null ? String(body.payout_provider).trim() : "";
    const payout_provider = ["startbutton", "paystack", "manual"].includes(payoutProviderRaw.toLowerCase())
      ? payoutProviderRaw.toLowerCase()
      : "manual";

    const merchantIds = Array.isArray(body.merchantIds)
      ? body.merchantIds.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const preview = await computePreview({ merchantIds, mode, cutoffTo, cursor, limit });
    const items = preview.rows;

    const results = [];
    for (const item of items) {
      const fromDate = parseDateSafe(item.from);
      const toDate = parseDateEndUtc(item.to);
      if (!fromDate || !toDate) {
        results.push({
          merchantId: item.merchantId,
          ok: false,
          error: "Invalid period",
        });
        continue;
      }

      const amountCents = Number(item.remainingCents || 0) || 0;
      if (amountCents <= 0) {
        results.push({ merchantId: item.merchantId, ok: false, error: "No payout" });
        continue;
      }

      try {
        const tx = await db.sequelize.transaction(async (t) => {
          const payoutTx = await db.MarketplaceAdminTransactions.create(
            {
              recipient_id: item.merchantId,
              trans_type: "payout",
              payout_provider,
              status: "pending",
              transaction_id: settlementKey(fromDate, toDate),
              amount: amountCents,
              currency: "USD",
              transaction_reference: transaction_reference || null,
              gateway_reference: note || null,
              completedAt: null,
              created_by: session.user.id,
              created_via: "admin_bulk",
            },
            { transaction: t }
          );

          await db.sequelize.query(
            `
              INSERT INTO public.marketplace_earnings_ledger_entries (
                recipient_id,
                amount_cents,
                currency,
                entry_type,
                marketplace_admin_transaction_id,
                earned_at,
                metadata,
                "createdAt",
                "updatedAt"
              ) VALUES (
                :recipientId,
                :amountCents,
                :currency,
                'payout_debit',
                :txId,
                now(),
                :metadata::jsonb,
                now(),
                now()
              )
              ON CONFLICT (marketplace_admin_transaction_id)
                WHERE entry_type = 'payout_debit'
              DO NOTHING
            `,
            {
              replacements: {
                recipientId: item.merchantId,
                txId: payoutTx.id,
                amountCents: -Math.abs(Number(amountCents || 0) || 0),
                currency: "USD",
                metadata: JSON.stringify({
                  settlement_from: item.from,
                  settlement_to: item.to,
                  payout_provider,
                  created_via: "admin_bulk",
                  created_by: session.user.id,
                  status: "pending",
                }),
              },
              transaction: t,
              type: db.Sequelize.QueryTypes.INSERT,
            }
          );

          await db.MarketplacePayoutEvent.create(
            {
              marketplace_admin_transaction_id: payoutTx.id,
              event_type: "payout_created",
              from_status: null,
              to_status: "pending",
              actor_type: "admin",
              actor_user_id: session.user.id,
              metadata: {
                recipient_id: item.merchantId,
                settlement_from: item.from,
                settlement_to: item.to,
                amount_cents: amountCents,
                currency: "USD",
              },
            },
            { transaction: t }
          );

          await db.sequelize.query(
            `
              INSERT INTO public.marketplace_payout_periods (
                recipient_id,
                marketplace_admin_transaction_id,
                settlement_from,
                settlement_to,
                is_active,
                "createdAt",
                "updatedAt"
              ) VALUES (
                :recipientId,
                :txId,
                :from::date,
                :to::date,
                TRUE,
                now(),
                now()
              )
            `,
            {
              replacements: {
                recipientId: item.merchantId,
                txId: payoutTx.id,
                from: item.from,
                to: item.to,
              },
              transaction: t,
              type: db.Sequelize.QueryTypes.INSERT,
            }
          );

          return payoutTx;
        });

        results.push({
          merchantId: item.merchantId,
          merchantName: item.merchantName,
          from: item.from,
          to: item.to,
          amount: Number((amountCents / 100).toFixed(2)),
          ok: true,
          txId: tx.id,
        });
      } catch (e) {
        const code = e?.original?.code || e?.code;
        const constraint = e?.original?.constraint || e?.constraint;
        const isOverlap = code === "23P01" || constraint === "marketplace_payout_periods_no_overlap";
        results.push({
          merchantId: item.merchantId,
          merchantName: item.merchantName,
          from: item.from,
          to: item.to,
          ok: false,
          error: isOverlap ? "Overlap blocked" : e?.message || "Failed",
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      status: "success",
      data: {
        mode,
        runMaxTo: preview.runMaxToIso,
        today: preview.todayIso,
        cursor: preview.cursor,
        nextCursor: preview.nextCursor,
        hasMore: preview.hasMore,
        limit: preview.limit,
        created: okCount,
        attempted: results.length,
        results,
      },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_payouts_bulk_create_post",
      route: "/api/admin/payouts/bulk/create",
      method: "POST",
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
