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
    const q = (searchParams.get("q") || "").slice(0, 200);
    const role = (searchParams.get("role") || "").slice(0, 50);
    const scopeRaw = searchParams.get("scope") || "privileged"; // privileged | all
    const scope = scopeRaw === "all" ? "all" : "privileged";
    const limitParam = Number(searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 500)
      : 200;

    const where = {};
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (role) where.role = role;

    // Default: only privileged users
    if (scope !== "all") {
      where[Op.or] = [
        ...(where[Op.or] || []),
        { role: "admin" },
        { role: "senior_admin" },
        { crowdpen_staff: true },
      ];
    }

    const users = await db.User.findAll({
      where,
      attributes: [
        "id",
        "name",
        "email",
        "image",
        "color",
        "role",
        "crowdpen_staff",
        "creator",
        "createdAt",
        "merchant",
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });

    return NextResponse.json({ status: "success", data: users });
  } catch (error) {
    console.error("/api/admin/users error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
