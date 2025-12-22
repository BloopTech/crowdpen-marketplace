import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";

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

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = new Date();
    const fromDate =
      parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    const sql = `
      WITH base AS (
        SELECT
          event_name,
          occurred_at,
          COALESCE(user_id::text, session_id) AS ident
        FROM marketplace_funnel_events
        WHERE occurred_at >= :from
          AND occurred_at <= :to
          AND COALESCE(user_id::text, session_id) IS NOT NULL
      ),
      visits AS (
        SELECT COUNT(DISTINCT ident)::bigint AS count
        FROM base
      ),
      stages AS (
        SELECT
          event_name,
          COUNT(DISTINCT ident)::bigint AS count
        FROM base
        GROUP BY 1
      )
      SELECT
        'visit'::text AS event_name,
        (SELECT count FROM visits) AS count
      UNION ALL
      SELECT event_name, count
      FROM stages
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { from: fromDate, to: toDate },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const map = new Map();
    for (const r of rows || []) {
      const k = String(r?.event_name || "");
      map.set(k, Number(r?.count || 0) || 0);
    }

    const visit = map.get("visit") || 0;
    const productView = map.get("product_view") || 0;
    const addToCart = map.get("add_to_cart") || 0;
    const checkoutStarted = map.get("checkout_started") || 0;
    const paid = map.get("paid") || 0;

    const safeRate = (num, den) => {
      const n = Number(num || 0) || 0;
      const d = Number(den || 0) || 0;
      if (d <= 0) return 0;
      return n / d;
    };

    const stageOrder = [
      "visit",
      "product_view",
      "add_to_cart",
      "checkout_started",
      "paid",
    ];

    const stagesOut = stageOrder.map((name) => ({
      event_name: name,
      count: map.get(name) || 0,
    }));

    const rates = {
      product_view_per_visit: safeRate(productView, visit),
      add_to_cart_per_product_view: safeRate(addToCart, productView),
      checkout_started_per_add_to_cart: safeRate(checkoutStarted, addToCart),
      paid_per_checkout_started: safeRate(paid, checkoutStarted),
      paid_per_visit: safeRate(paid, visit),
    };

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      data: { stages: stagesOut, rates },
    });
  } catch (error) {
    console.error("/api/admin/analytics/funnel error", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed" },
      { status: 500 }
    );
  }
}
