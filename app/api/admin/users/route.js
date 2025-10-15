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
    const q = searchParams.get("q") || "";
    const role = searchParams.get("role") || "";
    const scope = searchParams.get("scope") || "privileged"; // privileged | all
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

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
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
