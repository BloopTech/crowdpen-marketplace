import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function isUUID(v) {
  const s = String(v || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export const runtime = "nodejs";

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusRaw = searchParams.get("status"); // pending | approved | rejected | unverified
    const levelRaw = searchParams.get("level"); // basic | standard | enhanced
    const reviewer = searchParams.get("reviewer"); // reviewer user id (UUID)
    const limitParam = Number(searchParams.get("pageSize") || 20);
    const pageParam = Number(searchParams.get("page") || 1);
    const pageSize = Math.min(Math.max(limitParam, 1), 100);
    const page = Math.max(pageParam, 1);
    const offset = (page - 1) * pageSize;

    const where = {};
    if (statusRaw) {
      const s = String(statusRaw).toLowerCase();
      if (!["pending", "approved", "rejected", "unverified"].includes(s)) {
        return NextResponse.json(
          { status: "error", message: "Invalid status" },
          { status: 400 }
        );
      }
      where.status = s;
    }
    if (levelRaw) {
      const l = String(levelRaw).toLowerCase();
      if (!["basic", "standard", "enhanced"].includes(l)) {
        return NextResponse.json(
          { status: "error", message: "Invalid level" },
          { status: 400 }
        );
      }
      where.level = l;
    }
    if (reviewer) {
      if (!isUUID(reviewer)) {
        return NextResponse.json(
          { status: "error", message: "Invalid reviewer" },
          { status: 400 }
        );
      }
      where.reviewed_by = reviewer;
    }

    const { rows, count } = await db.MarketplaceKycVerification.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          attributes: [
            "id",
            "name",
            "email",
            "image",
            "color",
            "role",
            "creator",
            "merchant",
          ],
        },
        {
          model: db.User,
          as: "Reviewer",
          attributes: ["id", "name", "email", "image", "color"],
        },
      ],
      order: [["submitted_at", "DESC"]],
      limit: pageSize,
      offset,
    });

    return NextResponse.json({
      status: "success",
      page,
      pageSize,
      total: count,
      data: rows,
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_kyc_list",
      route: "/api/admin/kyc",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
