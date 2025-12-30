import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { validate as isUUID } from "uuid";

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
    const merchantIdRaw = String(searchParams.get("merchantId") || "").trim().slice(0, 128);
    const merchantId = merchantIdRaw && isUUID(merchantIdRaw) ? merchantIdRaw : null;

    const now = new Date();
    const fromDate = parseDateSafe(fromParam) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDateSafe(toParam) || now;

    const whereParts = [
      `LOWER(o."paymentStatus"::text) IN ('successful', 'completed')`,
      `o."createdAt" >= :from`,
      `o."createdAt" <= :to`,
    ];

    const replacements = {
      from: fromDate,
      to: toDate,
      limit,
    };

    if (merchantId) {
      whereParts.push(`p."user_id" = :merchantId`);
      replacements.merchantId = merchantId;
    }

    const whereSql = whereParts.join(" AND ");
    const sql =
      'SELECT\n'
      + '  p."id" AS "id",\n'
      + '  p."product_id" AS "productId",\n'
      + '  p."title" AS "title",\n'
      + '  p."currency" AS "currency",\n'
      + '  p."user_id" AS "merchantId",\n'
      + '  u."pen_name" AS "merchantPenName",\n'
      + '  u."name" AS "merchantName",\n'
      + '  COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",\n'
      + '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue"\n'
      + 'FROM "marketplace_order_items" AS oi\n'
      + 'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n'
      + 'JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"\n'
      + 'LEFT JOIN "users" AS u ON u."id" = p."user_id"\n'
      + 'WHERE ' + whereSql + '\n'
      + 'GROUP BY p."id", u."id"\n'
      + 'ORDER BY "revenue" DESC\n'
      + 'LIMIT :limit\n';

    const rows = await db.sequelize.query(sql, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

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

      return {
        id: r?.id,
        productId: r?.productId,
        title: r?.title,
        currency: r?.currency || null,
        merchantId: r?.merchantId,
        merchantPenName: r?.merchantPenName || null,
        merchantName: r?.merchantName || null,
        unitsSold: Number(r?.unitsSold || 0) || 0,
        revenue,
        crowdpenFee,
        startbuttonFee,
        creatorPayout,
      };
    });

    return NextResponse.json({
      status: "success",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      filters: { merchantId },
      limit,
      data,
    });
  } catch (error) {
    console.error("/api/admin/analytics/top-products error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
