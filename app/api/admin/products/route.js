import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const featured = Boolean(body?.featured);
    const flagged = typeof body?.flagged !== "undefined" ? Boolean(body.flagged) : undefined;
    if (!id) {
      return NextResponse.json({ status: "error", message: "Missing id" }, { status: 400 });
    }

    const product = await db.MarketplaceProduct.findOne({ where: { id } });
    if (!product) {
      return NextResponse.json({ status: "error", message: "Product not found" }, { status: 404 });
    }

    const patch = {};
    if (typeof body?.featured !== "undefined") patch.featured = featured;
    if (typeof flagged !== "undefined") patch.flagged = flagged;
    await product.update(patch);
    return NextResponse.json({ status: "success", data: { id, ...patch } });
  } catch (error) {
    console.error("/api/admin/products PATCH error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
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
    const pageParam = Number(searchParams.get("page") || 1);
    const pageSizeParam = Number(searchParams.get("pageSize") || 20);
    const q = (searchParams.get("q") || "").trim();
    const featured = searchParams.get("featured") || ""; // "true" | "false" | ""
    const flaggedParam = searchParams.get("flagged") || ""; // "true" | "false" | ""
    const sort = searchParams.get("sort") || "rank"; // rank | newest | price-low | price-high | rating | downloads
    const categoryId = searchParams.get("categoryId") || "";

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
    const unitsSoldLiteral = db.Sequelize.literal(`COALESCE((
      SELECT SUM(oi."quantity")
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      WHERE oi."marketplace_product_id" = "MarketplaceProduct"."id"
        AND o."paymentStatus" = 'completed'
    ), 0)`);
    const revenueLiteral = db.Sequelize.literal(`COALESCE((
      SELECT SUM((oi."subtotal")::numeric)
      FROM "marketplace_order_items" AS oi
      JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
      WHERE oi."marketplace_product_id" = "MarketplaceProduct"."id"
        AND o."paymentStatus" = 'completed'
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
        order = [["rating", "DESC"]];
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
        "featured",
        "inStock",
        "stock",
        "flagged",
        "rating",
        "authorRating",
        "price",
        "downloads",
        "createdAt",
        [rankScoreLiteral, "rankScore"],
        [salesCountLiteral, "salesCount"],
        [unitsSoldLiteral, "unitsSold"],
        [revenueLiteral, "totalRevenue"],
      ],
      order,
      limit: pageSize,
      offset,
      distinct: true,
    });

    // Parse optional fee rates from env (% provided as '0.2' or '20')
    const parsePct = (v) => {
      if (v == null || v === "") return 0;
      const n = Number(String(v).replace(/%/g, ""));
      if (!isFinite(n) || isNaN(n)) return 0;
      return n > 1 ? n / 100 : n; // accept 20 => 0.2
    };
    const CROWD_PCT = parsePct(process.env.CROWDPEN_FEE_PCT || process.env.CROWD_PEN_FEE_PCT || process.env.PLATFORM_FEE_PCT);
    const SB_PCT = parsePct(process.env.STARTBUTTON_FEE_PCT || process.env.START_BUTTON_FEE_PCT || process.env.GATEWAY_FEE_PCT);

    const data = rows.map((p) => {
      const j = p.toJSON();
      const revenue = Number(j.totalRevenue || 0) || 0;
      const crowdpenFee = revenue * (CROWD_PCT || 0);
      const startbuttonFee = revenue * (SB_PCT || 0);
      const creatorPayout = Math.max(0, revenue - crowdpenFee - startbuttonFee);
      return {
        id: j.id,
        title: j.title,
        featured: Boolean(j.featured),
        inStock: Boolean(j.inStock),
        stock: j.stock,
        flagged: Boolean(j.flagged),
        rating: Number(j.rating) || 0,
        authorRating: Number(j.authorRating) || 0,
        price: Number(j.price),
        downloads: Number(j.downloads) || 0,
        createdAt: j.createdAt,
        rankScore: Number(j.rankScore) || 0,
        salesCount: Number(j.salesCount) || 0,
        unitsSold: Number(j.unitsSold) || 0,
        totalRevenue: revenue,
        crowdpenFee,
        startbuttonFee,
        creatorPayout,
        category: j.MarketplaceCategory ? { id: j.MarketplaceCategory.id, name: j.MarketplaceCategory.name } : null,
        author: j.User ? { id: j.User.id, pen_name: j.User.pen_name, name: j.User.name } : null,
      };
    });

    return NextResponse.json({ status: "success", page, pageSize, total: count, data });
  } catch (error) {
    console.error("/api/admin/products error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
