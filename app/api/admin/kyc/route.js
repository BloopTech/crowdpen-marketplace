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
    const status = searchParams.get("status"); // pending | approved | rejected | unverified
    const level = searchParams.get("level"); // basic | standard | enhanced
    const reviewer = searchParams.get("reviewer"); // reviewer user id (UUID)
    const limitParam = Number(searchParams.get("pageSize") || 20);
    const pageParam = Number(searchParams.get("page") || 1);
    const pageSize = Math.min(Math.max(limitParam, 1), 100);
    const page = Math.max(pageParam, 1);
    const offset = (page - 1) * pageSize;

    const where = {};
    if (status) where.status = status;
    if (level) where.level = level;
    if (reviewer) where.reviewed_by = reviewer;

    const { rows, count } = await db.MarketplaceKycVerification.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          attributes: ["id", "name", "email", "image", "color", "role", "creator"],
        },
      ],
      order: [["submitted_at", "DESC"]],
      limit: pageSize,
      offset,
    });

    return NextResponse.json({ status: "success", page, pageSize, total: count, data: rows });
  } catch (error) {
    console.error("/api/admin/kyc error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
