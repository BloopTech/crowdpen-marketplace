import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { Op } from "sequelize";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function parseDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function parseDateEndUtc(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999));
    if (!Number.isFinite(dt.getTime())) return null;
    return dt;
  }
  return parseDateSafe(s);
}

function settlementKey(fromDate, toDate) {
  const fromKey = fromDate.toISOString().slice(0, 10);
  const toKey = toDate.toISOString().slice(0, 10);
  return `settlement:${fromKey}:${toKey}`;
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
    const recipientId = String(
      searchParams.get("recipientId") || searchParams.get("recipient_id") || ""
    ).trim();
    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

    if (!recipientId) {
      return NextResponse.json(
        { status: "error", message: "recipientId is required" },
        { status: 400 }
      );
    }

    const fromDate = parseDateSafe(fromParam);
    const toDate = parseDateEndUtc(toParam);

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { status: "error", message: "from and to are required" },
        { status: 400 }
      );
    }

    const key = settlementKey(fromDate, toDate);

    const where = {
      trans_type: "payout",
      recipient_id: recipientId,
      [Op.or]: [
        { transaction_id: key },
        {
          transaction_id: { [Op.is]: null },
          createdAt: { [Op.gte]: fromDate, [Op.lte]: toDate },
        },
      ],
    };

    const rows = await db.MarketplaceAdminTransactions.findAll({
      where,
      attributes: ["amount", "status"],
    });

    let completedCents = 0;
    let pendingCents = 0;
    let otherCents = 0;

    for (const r of rows || []) {
      const amt = Number(r?.amount || 0) || 0;
      const status = String(r?.status || "").toLowerCase();
      if (status === "completed") completedCents += amt;
      else if (status === "pending") pendingCents += amt;
      else otherCents += amt;
    }

    const toMajor = (cents) => (Number(cents || 0) || 0) / 100;

    return NextResponse.json({
      status: "success",
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
      data: {
        recipientId,
        settlementKey: key,
        payouts: {
          completed: toMajor(completedCents),
          pending: toMajor(pendingCents),
          other: toMajor(otherCents),
          total: toMajor(completedCents + pendingCents + otherCents),
        },
      },
    });
  } catch (error) {
    console.error("/api/admin/payouts/summary error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
