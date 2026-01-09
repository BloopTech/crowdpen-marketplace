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

    const limitParam = Number.parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 50;

    const stockThresholdParam = Number.parseInt(searchParams.get("stockThreshold") || "5", 10);
    const stockThreshold = Number.isFinite(stockThresholdParam)
      ? Math.min(Math.max(stockThresholdParam, 0), 100000)
      : 5;

    const velocityWindowDaysParam = Number.parseInt(searchParams.get("velocityWindowDays") || "30", 10);
    const velocityWindowDays = Number.isFinite(velocityWindowDaysParam)
      ? Math.min(Math.max(velocityWindowDaysParam, 1), 365)
      : 30;

    const toParam = (searchParams.get("to") || "").slice(0, 100);
    const toDate = parseDateSafe(toParam) || new Date();
    const fromDate = new Date(toDate.getTime() - velocityWindowDays * 24 * 60 * 60 * 1000);

    // Inventory risk is mainly for stocked products.
    // We estimate sales velocity from paid order_items over a window.
    // coverageDays = current_stock / (units_sold_in_window / window_days)
    const sql = `
      WITH window_sales AS (
        SELECT
          oi."marketplace_product_id" AS product_id,
          COALESCE(SUM(oi."quantity"), 0) AS units_sold
        FROM "marketplace_order_items" oi
        JOIN "marketplace_orders" o ON o."id" = oi."marketplace_order_id"
        WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
          AND o."createdAt" >= :from
          AND o."createdAt" <= :to
        GROUP BY 1
      )
      SELECT
        p."id" AS id,
        p."product_id" AS productId,
        p."title" AS title,
        p."inStock" AS inStock,
        p."stock" AS stock,
        p."price" AS price,
        p."currency" AS currency,
        p."user_id" AS merchantId,
        u."pen_name" AS merchantPenName,
        u."name" AS merchantName,
        COALESCE(ws.units_sold, 0) AS unitsSoldWindow
      FROM "marketplace_products" p
      LEFT JOIN window_sales ws ON ws.product_id = p."id"
      LEFT JOIN "users" u ON u."id" = p."user_id"
      WHERE p."inStock" = true
      ORDER BY (CASE WHEN p."stock" IS NULL THEN 1 ELSE 0 END) ASC,
               COALESCE(p."stock", 0) ASC,
               COALESCE(ws.units_sold, 0) DESC
      LIMIT :limit
    `;

    const rows = await db.sequelize.query(sql, {
      replacements: { from: fromDate, to: toDate, limit },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const data = (rows || [])
      .map((r) => {
        const stock = r?.stock == null ? null : Number(r.stock);
        const unitsSoldWindow = Number(r?.unitsSoldWindow || 0) || 0;
        const dailyVelocity = velocityWindowDays > 0 ? unitsSoldWindow / velocityWindowDays : 0;
        const coverageDays =
          stock != null && dailyVelocity > 0 ? stock / dailyVelocity : null;

        let risk = "low";
        if (stock != null && stock <= stockThreshold) risk = "high";
        else if (coverageDays != null && coverageDays <= 14) risk = "medium";

        return {
          id: r?.id,
          productId: r?.productId || null,
          title: r?.title,
          merchantId: r?.merchantId,
          merchantPenName: r?.merchantPenName || null,
          merchantName: r?.merchantName || null,
          inStock: Boolean(r?.inStock),
          stock,
          price: r?.price != null ? Number(r.price) : null,
          currency: r?.currency || null,
          unitsSoldWindow,
          dailyVelocity,
          coverageDays,
          risk,
          isLowStock: stock != null ? stock <= stockThreshold : false,
        };
      })
      .filter((r) => {
        // Show products that are actually risky or that have unknown stock but are selling.
        if (r.stock == null) return r.unitsSoldWindow > 0;
        return r.stock <= stockThreshold || (r.coverageDays != null && r.coverageDays <= 30);
      })
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.risk] ?? 99) - (order[b.risk] ?? 99);
      });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      stockThreshold,
      velocityWindowDays,
      limit,
      data,
    });
  } catch (error) {
    console.error("/api/admin/analytics/inventory-risk error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
