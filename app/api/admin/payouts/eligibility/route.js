import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function isoDay(d) {
  if (!d) return null;
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (!Number.isFinite(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function addDaysIso(dayStr, days) {
  const d = new Date(`${dayStr}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
    const recipientId = String(
      searchParams.get("recipientId") || searchParams.get("recipient_id") || ""
    ).trim();

    if (!recipientId) {
      return NextResponse.json(
        { status: "error", message: "recipientId is required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    let lastSettledTo = null;
    let payoutPeriodsAvailable = true;
    try {
      const [row] = await db.sequelize.query(
        `
          SELECT MAX(settlement_to) AS "lastSettledTo"
          FROM public.marketplace_payout_periods
          WHERE recipient_id = :merchantId
            AND is_active = TRUE
        `,
        {
          replacements: { merchantId: recipientId },
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );
      lastSettledTo = isoDay(row?.lastSettledTo);
    } catch (e) {
      const code = e?.original?.code || e?.code;
      if (code === "42P01") {
        payoutPeriodsAvailable = false;
      } else {
        throw e;
      }
    }

    const [windowSales] = await db.sequelize.query(
      `
        SELECT
          MIN(o."createdAt")::date AS "firstUnsettledSale",
          MAX(o."createdAt")::date AS "lastUnsettledSale"
        FROM "marketplace_order_items" AS oi
        JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
        JOIN "marketplace_products" AS p ON p."id" = oi."marketplace_product_id"
        WHERE p."user_id" = :merchantId
          AND o."paymentStatus" = 'successful'::"enum_marketplace_orders_paymentStatus"
          AND (:lastSettledTo::date IS NULL OR (o."createdAt"::date > :lastSettledTo::date))
      `,
      {
        replacements: { merchantId: recipientId, lastSettledTo },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const firstSale = isoDay(windowSales?.firstUnsettledSale);
    const lastSale = isoDay(windowSales?.lastUnsettledSale);

    if (!payoutPeriodsAvailable) {
      return NextResponse.json({
        status: "success",
        data: {
          recipientId,
          today,
          firstSale,
          lastSale,
          lastSettledTo,
          eligibleFrom: null,
          maxTo: null,
          canSettle: false,
          reason: "Payout periods table is missing. Apply the payout periods migration first.",
        },
      });
    }

    const eligibleFrom = firstSale;
    let maxTo = today;
    if (lastSale && lastSale < maxTo) maxTo = lastSale;

    const canSettle = Boolean(eligibleFrom && eligibleFrom <= maxTo);

    return NextResponse.json({
      status: "success",
      data: {
        recipientId,
        today,
        firstSale,
        lastSale,
        lastSettledTo,
        eligibleFrom: canSettle ? eligibleFrom : null,
        maxTo: canSettle ? maxTo : null,
        canSettle,
      },
    });
  } catch (error) {
    await reportError(error, {
      tag: "admin_payouts_eligibility_get",
      route: "/api/admin/payouts/eligibility",
      method: "GET",
      status: 500,
      requestId,
      userId,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : error?.message || "Failed" },
      { status: 500 }
    );
  }
}
