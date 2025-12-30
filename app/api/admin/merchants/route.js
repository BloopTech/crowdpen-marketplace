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
    const limitParam = Number.parseInt(searchParams.get("pageSize") || "20", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = (page - 1) * pageSize;
    const q = (searchParams.get("q") || "").slice(0, 200);
    const requestedApplicantStatus =
      searchParams.get("applicantStatus") || "pending";
    const applicantStatus = ["pending", "rejected"].includes(
      requestedApplicantStatus
    )
      ? requestedApplicantStatus
      : "pending";

    // Merchants (users with merchant=true)
    const whereMerchants = { merchant: true };
    if (q) {
      whereMerchants[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }
    const merchantsRes = await db.User.findAndCountAll({
      where: whereMerchants,
      attributes: [
        "id",
        "name",
        "email",
        "image",
        "color",
        "role",
        "creator",
        "crowdpen_staff",
        "createdAt",
        "merchant",
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    // applicants (users with KYC submitted; status != 'unverified')
    const applicantUserInclude = {
      model: db.User,
      attributes: ["id", "name", "email", "image", "color", "role"],
    };
    if (q) {
      applicantUserInclude.where = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } },
        ],
      };
      applicantUserInclude.required = true;
    }

    const applicantsRes = await db.MarketplaceKycVerification.findAndCountAll({
      where: { status: applicantStatus },
      include: [applicantUserInclude],
      order: [["submitted_at", "DESC"]],
      limit: pageSize,
      offset,
    });

    return NextResponse.json({
      status: "success",
      page,
      pageSize,
      merchants: merchantsRes.rows,
      merchantsTotal: merchantsRes.count,
      applicants: applicantsRes.rows,
      applicantsTotal: applicantsRes.count,
      applicantsStatus: applicantStatus,
    });
  } catch (error) {
    console.error("/api/admin/merchants error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
