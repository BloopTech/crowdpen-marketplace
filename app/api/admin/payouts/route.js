import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
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

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userIdForRl = String(session.user.id);
    const rl = rateLimit({ key: `admin-payouts:list:${userIdForRl}:${ip}`, limit: 240, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get("pageSize") || "20", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);
    const formatParam = (searchParams.get("format") || "json").toLowerCase();
    const format = formatParam === "csv" ? "csv" : "json";
    const pageSize = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = (page - 1) * pageSize;

    const parseDateSafe = (v) => {
      if (!v) return null;
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return null;
      return d;
    };
    const fromDate = parseDateSafe(fromParam);
    const toDate = parseDateSafe(toParam);

    const where = { trans_type: "payout" };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = fromDate;
      if (toDate) where.createdAt[Op.lte] = toDate;
    }

    const toMajor = (n) => {
      const v = n != null ? Number(n) : NaN;
      if (!Number.isFinite(v)) return 0;
      return v / 100;
    };

    if (format === "csv") {
      const rows = await db.MarketplaceAdminTransactions.findAll({
        where,
        include: [
          { model: db.User, attributes: ["id", "name", "email", "image", "color"] },
          { model: db.User, as: "CreatedBy", attributes: ["id", "name", "email"] },
        ],
        order: [["createdAt", "DESC"]],
      });
      const header = [
        "id",
        "recipient",
        "created_by",
        "created_via",
        "amount",
        "currency",
        "status",
        "transaction_reference",
        "createdAt",
      ];
      const esc = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const lines = [header.join(",")];
      for (const tx of rows) {
        const recipient = tx?.User?.name || tx?.User?.email || tx.recipient_id;
        const createdBy = tx?.CreatedBy?.name || tx?.CreatedBy?.email || tx.created_by || "";
        lines.push([
          esc(tx.id),
          esc(recipient),
          esc(createdBy),
          esc(tx.created_via || ""),
          esc(toMajor(tx.amount)),
          esc(tx.currency),
          esc(tx.status),
          esc(tx.transaction_reference || ""),
          esc(tx.createdAt?.toISOString?.() || tx.createdAt),
        ].join(","));
      }
      const csv = lines.join("\n");
      const dateStr = new Date().toISOString().slice(0, 10);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=payouts_${dateStr}.csv`,
        },
      });
    } else {
      const { rows, count } = await db.MarketplaceAdminTransactions.findAndCountAll({
        where,
        include: [
          { model: db.User, attributes: ["id", "name", "email", "image", "color"] },
          { model: db.User, as: "CreatedBy", attributes: ["id", "name", "email"] },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset,
      });

      const data = (rows || []).map((r) => ({
        ...r.toJSON(),
        amount: toMajor(r.amount),
      }));

      return NextResponse.json({ status: "success", page, pageSize, total: count, data });
    }
  } catch (error) {
    await reportError(error, {
      tag: "admin_payouts_list",
      route: "/api/admin/payouts",
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
