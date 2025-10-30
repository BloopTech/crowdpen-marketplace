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
    if (!id) {
      return NextResponse.json({ status: "error", message: "Missing id" }, { status: 400 });
    }

    const product = await db.MarketplaceProduct.findOne({ where: { id } });
    if (!product) {
      return NextResponse.json({ status: "error", message: "Product not found" }, { status: 404 });
    }

    await product.update({ featured });
    return NextResponse.json({ status: "success", data: { id, featured } });
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
    if (categoryId) where.marketplace_category_id = categoryId;

    const rankScoreLiteral = db.Sequelize.literal(`
      (CASE WHEN "MarketplaceProduct"."featured" = true THEN 10 ELSE 0 END)
      + (1.5 * COALESCE("MarketplaceProduct"."rating", 0))
      + (1.0 * COALESCE("MarketplaceProduct"."authorRating", 0))
    `);

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
        "rating",
        "authorRating",
        "price",
        "downloads",
        "createdAt",
        [rankScoreLiteral, "rankScore"],
      ],
      order,
      limit: pageSize,
      offset,
      distinct: true,
    });

    const data = rows.map((p) => {
      const j = p.toJSON();
      return {
        id: j.id,
        title: j.title,
        featured: Boolean(j.featured),
        rating: Number(j.rating) || 0,
        authorRating: Number(j.authorRating) || 0,
        price: Number(j.price),
        downloads: Number(j.downloads) || 0,
        createdAt: j.createdAt,
        rankScore: Number(j.rankScore) || 0,
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
