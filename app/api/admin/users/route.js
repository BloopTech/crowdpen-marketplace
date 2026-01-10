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
    const id = (searchParams.get("id") || searchParams.get("userId") || "")
      .toString()
      .slice(0, 120)
      .trim();
    const q = (searchParams.get("q") || "").slice(0, 200);
    const role = (searchParams.get("role") || "").slice(0, 50);
    const scopeRaw = searchParams.get("scope") || "privileged"; // privileged | all
    const scope = scopeRaw === "all" ? "all" : "privileged";
    const merchantRaw = (searchParams.get("merchant") || "").toLowerCase();
    const merchantOnly =
      merchantRaw === "1" || merchantRaw === "true" || merchantRaw === "yes";

    const includeKycExemptRaw = (
      searchParams.get("includeKycExempt") || ""
    ).toLowerCase();
    const includeKycExempt =
      includeKycExemptRaw === "1" ||
      includeKycExemptRaw === "true" ||
      includeKycExemptRaw === "yes";

    const pageParam = Number.parseInt(searchParams.get("page") || "", 10);
    const pageSizeParam = Number.parseInt(
      searchParams.get("pageSize") || searchParams.get("page_size") || "",
      10
    );
    const usePagination =
      Number.isFinite(pageParam) || Number.isFinite(pageSizeParam);
    const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1;
    const pageSize = Number.isFinite(pageSizeParam)
      ? Math.min(Math.max(pageSizeParam, 1), 100)
      : 20;

    const limitParam = Number(searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 500)
      : 200;

    const whereAnd = [];
    if (id) whereAnd.push({ id });
    if (q) {
      whereAnd.push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }
    if (role) whereAnd.push({ role });

    if (merchantOnly) {
      if (includeKycExempt) {
        whereAnd.push({
          [Op.or]: [
            { merchant: true },
            { crowdpen_staff: true },
            { role: "admin" },
            { role: "senior_admin" },
          ],
        });
      } else {
        whereAnd.push({ merchant: true });
      }
    }

    // Default: only privileged users
    if (scope !== "all") {
      whereAnd.push({
        [Op.or]: [
          { role: "admin" },
          { role: "senior_admin" },
          { crowdpen_staff: true },
        ],
      });
    }

    const where = whereAnd.length ? { [Op.and]: whereAnd } : {};

    const attributes = [
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
    ];

    if (id) {
      const user = await db.User.findOne({ where, attributes });
      if (!user) {
        return NextResponse.json(
          { status: "error", message: "Not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ status: "success", data: user });
    }

    if (usePagination) {
      const offset = (page - 1) * pageSize;
      const result = await db.User.findAndCountAll({
        where,
        attributes,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset,
      });

      const total = Number(result?.count || 0) || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return NextResponse.json({
        status: "success",
        data: result?.rows || [],
        page,
        pageSize,
        total,
        totalPages,
      });
    }

    const users = await db.User.findAll({
      where,
      attributes,
      order: [["createdAt", "DESC"]],
      limit,
    });

    return NextResponse.json({ status: "success", data: users });
  } catch (error) {
    await reportError(error, {
      tag: "admin_users_list",
      route: "/api/admin/users",
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
