import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";
import { getMarketplaceFeePercents } from "../../../lib/marketplaceFees";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function parseOptionalBoolean(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
    return undefined;
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return undefined;
}

export async function PATCH(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-products:patch:${userIdForRl}:${ip}`, limit: 120, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || "").trim().slice(0, 128);
    const featured = parseOptionalBoolean(body?.featured);
    const flagged = parseOptionalBoolean(body?.flagged);
    if (!id) {
      return NextResponse.json({ status: "error", message: "Missing id" }, { status: 400 });
    }

    const product = await db.MarketplaceProduct.findOne({ where: { id } });
    if (!product) {
      return NextResponse.json({ status: "error", message: "Product not found" }, { status: 404 });
    }

    const patch = {};
    if (typeof body?.featured !== "undefined" && typeof featured !== "undefined") {
      patch.featured = featured;
    }
    if (typeof body?.flagged !== "undefined" && typeof flagged !== "undefined") {
      patch.flagged = flagged;
    }
    await product.update(patch);
    return NextResponse.json({ status: "success", data: { id, ...patch } });
  } catch (error) {
    await reportError(error, {
      route: "/api/admin/products",
      method: "PATCH",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "admin_products_patch",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-products:list:${userIdForRl}:${ip}`, limit: 240, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);
    const pageParam = Number(searchParams.get("page") || 1);
    const pageSizeParam = Number(searchParams.get("pageSize") || 20);
    const q = (searchParams.get("q") || "").trim().slice(0, 200);
    const featured = searchParams.get("featured") || ""; // "true" | "false" | ""
    const flaggedParam = searchParams.get("flagged") || ""; // "true" | "false" | ""
    const sort = searchParams.get("sort") || "rank"; // rank | newest | price-low | price-high | rating | downloads
    const categoryId = searchParams.get("categoryId") || "";
    const fromParam = searchParams.get("from") || "";
    const toParam = searchParams.get("to") || "";

    const page = Math.max(1, pageParam);
    const pageSize = Math.min(Math.max(1, pageSizeParam), 100);
    const offset = (page - 1) * pageSize;

    const where = {};
    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (featured === "true") where.featured = true;
    if (featured === "false") where.featured = false;
    if (flaggedParam === "true") where.flagged = true;
    if (flaggedParam === "false") where.flagged = false;
    if (categoryId) where.marketplace_category_id = categoryId;

    const parseDateSafe = (v) => {
      if (!v) return null;
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return null;
      return d;
    };
    const fromDate = parseDateSafe(fromParam);
    const toDate = parseDateSafe(toParam);

    const rankScoreLiteral = db.Sequelize.literal(`
      (CASE WHEN "MarketplaceProduct"."featured" = true THEN 10 ELSE 0 END)
      + (1.5 * COALESCE("MarketplaceProduct"."rating", 0))
      + (1.0 * COALESCE("MarketplaceProduct"."authorRating", 0))
      + (0.5 * LN(COALESCE((
          SELECT s."sales_count"
          FROM "mv_product_sales" AS s
          WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
        ), 0) + 1))
    `);
    const salesCountLiteral = db.Sequelize.literal(`COALESCE((
      SELECT s."sales_count"
      FROM "mv_product_sales" AS s
      WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
    ), 0)`);

    const ratingAvgLiteral = db.Sequelize.literal(`COALESCE((
      SELECT AVG(r."rating")
      FROM "marketplace_reviews" AS r
      WHERE r."marketplace_product_id" = "MarketplaceProduct"."id"
        AND r."visible" = true
    ), 0)`);

    let order = [];
    switch (sort) {
      case "price-low":
        order = [["price", "ASC"]];
        break;
      case "price-high":
        order = [["price", "DESC"]];
        break;
      case "rating":
        order = [[ratingAvgLiteral, "DESC"]];
        break;
      case "downloads":
        order = [["downloads", "DESC"]];
        break;
      case "bestsellers":
        order = [[salesCountLiteral, "DESC"]];
        break;
      case "newest":
        order = [["createdAt", "DESC"]];
        break;
      case "rank":
      default:
        order = [[rankScoreLiteral, "DESC"], ["createdAt", "DESC"]];
        break;
    }

    const { rows, count } = await db.MarketplaceProduct.findAndCountAll({
      where,
      include: [
        { model: db.MarketplaceCategory, attributes: ["id", "name"], required: false },
        { model: db.User, attributes: ["id", "pen_name", "name"], required: false },
      ],
      attributes: [
        "id",
        "title",
        "currency",
        "featured",
        "inStock",
        "stock",
        "flagged",
        "rating",
        "authorRating",
        "reviewCount",
        "price",
        "downloads",
        "createdAt",
        [rankScoreLiteral, "rankScore"],
        [salesCountLiteral, "salesCount"],
      ],
      order,
      limit: pageSize,
      offset,
      distinct: true,
    });

    const productIds = rows.map((p) => p.id).filter(Boolean);

    const reviewAggByProductId = new Map();
    if (productIds.length > 0) {
      const reviewAggRows = await db.MarketplaceReview.findAll({
        where: {
          marketplace_product_id: { [Op.in]: productIds },
          visible: true,
        },
        attributes: [
          "marketplace_product_id",
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
          [db.Sequelize.fn("AVG", db.Sequelize.col("rating")), "avg"],
        ],
        group: ["marketplace_product_id"],
        raw: true,
      });
      for (const row of reviewAggRows || []) {
        const pid = String(row.marketplace_product_id);
        const count = Number(row.count || 0) || 0;
        const avgRaw = Number(row.avg || 0) || 0;
        const avg = Math.round(avgRaw * 10) / 10;
        reviewAggByProductId.set(pid, { count, avg });
      }
    }

    const aggByProductId = new Map();
    if (productIds.length > 0) {
      const whereParts = [
        `oi."marketplace_product_id" IN (:productIds)`,
        `o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"`,
      ];
      const replacements = { productIds };
      if (fromDate) {
        whereParts.push(`o."createdAt" >= :from`);
        replacements.from = fromDate;
      }
      if (toDate) {
        whereParts.push(`o."createdAt" <= :to`);
        replacements.to = toDate;
      }

      const whereSql = whereParts.join(" AND ");
      const aggSql =
        'SELECT\n'
        + '  oi."marketplace_product_id" AS "marketplace_product_id",\n'
        + '  COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",\n'
        + '  COALESCE(SUM((oi."subtotal")::numeric), 0) AS "totalRevenue",\n'
        + '  COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal",\n'
        + '  COALESCE(SUM(\n'
        + '    CASE\n'
        + '      WHEN NOT (cu."id" IS NULL OR cu."crowdpen_staff" = true OR cu."role" IN (\'admin\', \'senior_admin\'))\n'
        + '        THEN (ri."discount_amount")::numeric\n'
        + '      ELSE 0\n'
        + '    END\n'
        + '  ), 0) AS "discountMerchantFunded"\n'
        + 'FROM "marketplace_order_items" AS oi\n'
        + 'JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"\n'
        + 'LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"\n'
        + 'LEFT JOIN "marketplace_coupon_redemptions" AS r ON r."id" = ri."redemption_id"\n'
        + 'LEFT JOIN "marketplace_coupons" AS c ON c."id" = r."coupon_id"\n'
        + 'LEFT JOIN "users" AS cu ON cu."id" = c."created_by"\n'
        + 'WHERE ' + whereSql + '\n'
        + 'GROUP BY 1\n';

      const aggRows = await db.sequelize.query(aggSql, {
        replacements,
        type: db.Sequelize.QueryTypes.SELECT,
      });

      for (const r of aggRows || []) {
        aggByProductId.set(String(r.marketplace_product_id), {
          unitsSold: Number(r.unitsSold || 0) || 0,
          totalRevenue: Number(r.totalRevenue || 0) || 0,
          discountTotal: Number(r.discountTotal || 0) || 0,
          discountMerchantFunded: Number(r.discountMerchantFunded || 0) || 0,
        });
      }
    }

    const { crowdpenPct: CROWD_PCT, startbuttonPct: SB_PCT } =
      await getMarketplaceFeePercents({ db });

    const data = rows.map((p) => {
      const j = p.toJSON();
      const agg = aggByProductId.get(String(j.id)) || { unitsSold: 0, totalRevenue: 0 };
      const revenue = Number(agg.totalRevenue || 0) || 0;
      const discountTotal = Number(agg.discountTotal || 0) || 0;
      const discountMerchantFunded = Number(agg.discountMerchantFunded || 0) || 0;
      const buyerPaid = Math.max(0, revenue - discountTotal);
      const crowdpenFee = revenue * (CROWD_PCT || 0);
      const startbuttonFee = buyerPaid * (SB_PCT || 0);
      const creatorPayout = Math.max(
        0,
        revenue - discountMerchantFunded - crowdpenFee - startbuttonFee
      );

      const reviewAgg = reviewAggByProductId.get(String(j.id));
      const rating = Number.isFinite(reviewAgg?.avg) ? reviewAgg.avg : 0;
      const reviewCount = Number(reviewAgg?.count || 0) || 0;
      return {
        id: j.id,
        title: j.title,
        currency: j.currency,
        featured: Boolean(j.featured),
        inStock: Boolean(j.inStock),
        stock: j.stock,
        flagged: Boolean(j.flagged),
        rating,
        authorRating: Number(j.authorRating) || 0,
        reviewCount,
        price: Number(j.price),
        downloads: Number(j.downloads) || 0,
        createdAt: j.createdAt,
        rankScore: Number(j.rankScore) || 0,
        salesCount: Number(j.salesCount) || 0,
        unitsSold: Number(agg.unitsSold) || 0,
        totalRevenue: revenue,
        discountTotal,
        discountMerchantFunded,
        buyerPaid,
        crowdpenFee,
        startbuttonFee,
        creatorPayout,
        category: j.MarketplaceCategory ? { id: j.MarketplaceCategory.id, name: j.MarketplaceCategory.name } : null,
        author: j.User ? { id: j.User.id, pen_name: j.User.pen_name, name: j.User.name } : null,
      };
    });

    return NextResponse.json({ status: "success", page, pageSize, total: count, data });
  } catch (error) {
    await reportError(error, {
      route: "/api/admin/products",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "admin_products_list",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed" : error?.message || "Failed",
      },
      { status: 500 }
    );
  }
}
