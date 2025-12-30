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

    // Basic counts
    const [totalUsers, totalMerchants, pendingKyc, transactions] = await Promise.all([
      db.User.count(),
      db.User.count({ where: { merchant: true } }),
      db.MarketplaceKycVerification.count({ where: { status: "pending" } }),
      db.MarketplaceAdminTransactions.count(),
    ]);

    // Sum payouts
    const payouts = await db.MarketplaceAdminTransactions.findAll({
      attributes: ["amount", "currency", "status", "trans_type"],
    });
    let totalPayoutAmount = 0;
    for (const p of payouts) {
      if (p?.amount) totalPayoutAmount += Number(p.amount) || 0;
    }
    totalPayoutAmount = totalPayoutAmount / 100;

    // Total sales from orders
    const orders = await db.MarketplaceOrder.findAll({ attributes: ["total", "currency", "paymentStatus"] });
    let totalSales = 0;
    for (const o of orders) {
      const ps = String(o?.paymentStatus || "").toLowerCase();
      if (["successful", "completed"].includes(ps) && o?.total) {
        totalSales += Number(o.total) || 0;
      }
    }

    return NextResponse.json({
      status: "success",
      data: {
        totalUsers,
        totalMerchants,
        pendingKyc,
        transactions,
        totalPayoutAmount,
        totalSales,
      },
    });
  } catch (error) {
    console.error("/api/admin/dashboard error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
