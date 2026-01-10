import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op, col, where as sqlWhere } from "sequelize";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

// Placeholder tickets API
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

    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get("pageSize") || "20", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const q = (searchParams.get("q") || "").trim().slice(0, 200);
    const pageSize = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
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
    await reportError(error, {
      route: "/api/admin/tickets",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "admin_tickets_list",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
