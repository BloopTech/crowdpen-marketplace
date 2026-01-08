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

function parsePct(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/%/g, ""));
  if (!isFinite(n) || isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
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
    const limitParam = Number.parseInt(searchParams.get("limit") || "10", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 10;

    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    const now = new Date();
    const fromDate = parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    const replacements = { from: fromDate, to: toDate, limit };

    const sql = `
      SELECT
        u."id" AS "id",
        u."pen_name" AS "penName",
        u."name" AS "name",
        u."email" AS "email",
        COUNT(DISTINCT o."id")::bigint AS "orderCount",
        COUNT(DISTINCT p."id")::bigint AS "productsSoldCount",
        COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",
        COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue"
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      JOIN "users" AS u ON u."id" = p."user_id"
      WHERE LOWER(o."paymentStatus"::text) IN ('successful', 'completed')
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
      GROUP BY u."id"
      ORDER BY "revenue" DESC
      LIMIT :limit
    `;

    const rows = await db.sequelize.query(sql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const discountSql = `
      SELECT
        p."user_id" AS "merchantId",
        COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",
        COALESCE(SUM(
          CASE
            WHEN (cu."id" IS NULL OR cu."crowdpen_staff" = true OR LOWER(cu."role"::text) IN ('admin', 'senior_admin'))
              THEN (ri."discount_amount")::numeric
            ELSE 0
          END
        ), 0) AS "discountCrowdpenFunded",
        COALESCE(SUM(
          CASE
            WHEN NOT (cu."id" IS NULL OR cu."crowdpen_staff" = true OR LOWER(cu."role"::text) IN ('admin', 'senior_admin'))
              THEN (ri."discount_amount")::numeric
            ELSE 0
          END
        ), 0) AS "discountMerchantFunded"
      FROM "marketplace_coupon_redemption_items" AS ri
      JOIN "marketplace_coupon_redemptions" AS r ON r."id" = ri."redemption_id"
      JOIN "marketplace_coupons" AS c ON c."id" = r."coupon_id"
      LEFT JOIN "users" AS cu ON cu."id" = c."created_by"
      JOIN "marketplace_order_items" AS oi ON oi."id" = ri."order_item_id"
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
      WHERE LOWER(o."paymentStatus"::text) IN ('successful', 'completed')
        AND o."createdAt" >= :from
        AND o."createdAt" <= :to
      GROUP BY 1
    `;

    const discountRows = await db.sequelize.query(discountSql, {
      replacements: { from: fromDate, to: toDate },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const discountByMerchantId = new Map(
      (discountRows || []).map((r) => [String(r?.merchantId || ""), r])
    );

    const CROWD_PCT = parsePct(
      process.env.CROWDPEN_FEE_PCT ||
        process.env.CROWD_PEN_FEE_PCT ||
        process.env.PLATFORM_FEE_PCT
    );
    const SB_PCT = parsePct(
      process.env.STARTBUTTON_FEE_PCT ||
        process.env.START_BUTTON_FEE_PCT ||
        process.env.GATEWAY_FEE_PCT
    );

    const data = (rows || []).map((r) => {
      const revenue = Number(r?.revenue || 0) || 0;
      const crowdpenFee = revenue * (CROWD_PCT || 0);
      const startbuttonFee = revenue * (SB_PCT || 0);
      const creatorPayout = Math.max(0, revenue - crowdpenFee - startbuttonFee);

      const dRow = discountByMerchantId.get(String(r?.id || "")) || null;
      const discountTotal = Number(dRow?.discountTotal || 0) || 0;
      const discountCrowdpenFunded = Number(dRow?.discountCrowdpenFunded || 0) || 0;
      const discountMerchantFunded = Number(dRow?.discountMerchantFunded || 0) || 0;
      const crowdpenNetAfterDiscount = crowdpenFee - discountCrowdpenFunded;

      return {
        id: r?.id,
        merchantId: r?.id,
        penName: r?.penName || null,
        name: r?.name || null,
        email: r?.email || null,
        orderCount: Number(r?.orderCount || 0) || 0,
        productsSoldCount: Number(r?.productsSoldCount || 0) || 0,
        unitsSold: Number(r?.unitsSold || 0) || 0,
        revenue,
        crowdpenFee,
        crowdpenNetAfterDiscount,
        startbuttonFee,
        creatorPayout,
        discountTotal,
        discountCrowdpenFunded,
        discountMerchantFunded,
      };
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      limit,
      data,
    });
  } catch (error) {
    console.error("/api/admin/analytics/top-merchants error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
