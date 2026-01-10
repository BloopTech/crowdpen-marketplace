import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
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

    // Basic counts
    const [totalUsers, totalMerchants, pendingKyc, transactions] = await Promise.all([
      db.User.count(),
      db.User.count({ where: { merchant: true } }),
      db.MarketplaceKycVerification.count({ where: { status: "pending" } }),
      db.MarketplaceAdminTransactions.count(),
    ]);

    const [totalPayoutAmountCents, salesAggRows] = await Promise.all([
      db.MarketplaceAdminTransactions.sum("amount", {
        where: {
          trans_type: "payout",
          status: { [Op.in]: ["completed"] },
        },
      }),
      db.sequelize.query(
        `
          SELECT
            COALESCE(SUM((oi."subtotal")::numeric), 0) AS "revenue",
            COALESCE(SUM((ri."discount_amount")::numeric), 0) AS "discountTotal"
          FROM "marketplace_order_items" AS oi
          JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
          LEFT JOIN "marketplace_coupon_redemption_items" AS ri ON ri."order_item_id" = oi."id"
          WHERE o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
        `,
        { type: db.Sequelize.QueryTypes.SELECT }
      ),
    ]);

    const totalPayoutAmount = (Number(totalPayoutAmountCents) || 0) / 100;

    const grossRevenue = Number(salesAggRows?.[0]?.revenue || 0) || 0;
    const discountTotal = Number(salesAggRows?.[0]?.discountTotal || 0) || 0;
    const totalSales = Math.max(0, grossRevenue - discountTotal);

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
    await reportError(error, {
      tag: "admin_dashboard_get",
      route: "/api/admin/dashboard",
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
