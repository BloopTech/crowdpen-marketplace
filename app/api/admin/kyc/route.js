import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";

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

    const where = {};
    if (status) where.status = status;

    const records = await db.MarketplaceKycVerification.findAll({
      where,
      include: [
        {
          model: db.User,
          attributes: ["id", "name", "email", "role", "creator"],
        },
      ],
      order: [["submitted_at", "DESC"]],
    });

    return NextResponse.json({ status: "success", data: records });
  } catch (error) {
    console.error("/api/admin/kyc error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
