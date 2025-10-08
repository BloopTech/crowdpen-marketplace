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

    const items = await db.MarketplaceOrderItems.findAll({
      include: [
        {
          model: db.MarketplaceOrder,
          include: [{ model: db.User, attributes: ["id", "name", "email"] }],
        },
        { model: db.MarketplaceProduct, attributes: ["id", "title"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    const licenses = items.map((it) => ({
      id: it.id,
      order_id: it.marketplace_order_id,
      user: {
        id: it?.MarketplaceOrder?.User?.id,
        name: it?.MarketplaceOrder?.User?.name,
        email: it?.MarketplaceOrder?.User?.email,
      },
      product: {
        id: it?.MarketplaceProduct?.id,
        title: it?.MarketplaceProduct?.title,
      },
      downloadUrl: it.downloadUrl || null,
      downloadCount: it.downloadCount || 0,
      lastDownloaded: it.lastDownloaded || null,
      createdAt: it.createdAt,
    }));

    return NextResponse.json({ status: "success", data: licenses });
  } catch (error) {
    console.error("/api/admin/licenses error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
