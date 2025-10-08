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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const list = await db.MarketplaceAdminTransactions.findAll({
      include: [
        { model: db.User, attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    return NextResponse.json({ status: "success", data: list });
  } catch (error) {
    console.error("/api/admin/payouts error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
