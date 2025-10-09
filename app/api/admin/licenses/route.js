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
    const limitParam = Number(searchParams.get("pageSize") || 20);
    const pageParam = Number(searchParams.get("page") || 1);
    const pageSize = Math.min(Math.max(limitParam, 1), 100);
    const page = Math.max(pageParam, 1);
    const offset = (page - 1) * pageSize;

    const { rows, count } = await db.MarketplaceOrderItems.findAndCountAll({
      include: [
        {
          model: db.MarketplaceOrder,
          include: [{ model: db.User, attributes: ["id", "name", "email", "image", "color"] }],
        },
        { model: db.MarketplaceProduct, attributes: ["id", "title"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    const licenses = rows.map((it) => ({
      id: it.id,
      order_id: it.marketplace_order_id,
      user: {
        id: it?.MarketplaceOrder?.User?.id,
        name: it?.MarketplaceOrder?.User?.name,
        email: it?.MarketplaceOrder?.User?.email,
        image: it?.MarketplaceOrder?.User?.image,
        color: it?.MarketplaceOrder?.User?.color,
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

    return NextResponse.json({ status: "success", page, pageSize, total: count, data: licenses });
  } catch (error) {
    console.error("/api/admin/licenses error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
