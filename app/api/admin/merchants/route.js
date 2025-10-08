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
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);
    const q = searchParams.get("q") || "";

    // Merchants (users with creator=true)
    const whereMerchants = { creator: true };
    if (q) {
      whereMerchants[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }
    const merchants = await db.User.findAll({
      where: whereMerchants,
      attributes: ["id", "name", "email", "role", "creator", "crowdpen_staff", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit,
    });

    // Applicants (users with KYC submitted; status != 'unverified')
    const applicants = await db.MarketplaceKycVerification.findAll({
      where: { status: { [Op.ne]: "unverified" } },
      include: [{ model: db.User, attributes: ["id", "name", "email", "role"] }],
      order: [["submitted_at", "DESC"]],
      limit,
    });

    return NextResponse.json({ status: "success", merchants, applicants });
  } catch (error) {
    console.error("/api/admin/merchants error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
