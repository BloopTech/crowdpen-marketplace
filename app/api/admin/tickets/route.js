import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op, col, where as sqlWhere } from "sequelize";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

// Placeholder tickets API
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
    const limitParam = Number(searchParams.get("pageSize") || 20);
    const pageParam = Number(searchParams.get("page") || 1);
    const q = (searchParams.get("q") || "").trim();
    const pageSize = Math.min(Math.max(limitParam, 1), 100);
    const page = Math.max(pageParam, 1);
    const offset = (page - 1) * pageSize;

    const where = {};
    if (q) {
      const like = { [Op.iLike]: `%${q}%` };
      where[Op.or] = [
        { subject: like },
        sqlWhere(col("User.name"), like),
        sqlWhere(col("User.email"), like),
      ];
    }

    const { rows, count } = await db.MarketplaceTicket.findAndCountAll({
      where,
      include: [
        { model: db.User, attributes: ["id", "name", "email", "image", "color"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    const data = rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      category: t.category,
      createdAt: t.createdAt,
      user: {
        id: t?.User?.id,
        name: t?.User?.name,
        email: t?.User?.email,
        image: t?.User?.image,
        color: t?.User?.color,
      },
    }));

    return NextResponse.json({ status: "success", page, pageSize, total: count, data });
  } catch (error) {
    console.error("/api/admin/tickets error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
