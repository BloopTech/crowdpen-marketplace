import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get("pageSize") || "20", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);
    const q = (searchParams.get("q") || "").slice(0, 200);
    const statusParam = (searchParams.get("status") || "").slice(0, 50);
    const typeParam = (searchParams.get("type") || "").slice(0, 50);
    const recipientIdParam = (searchParams.get("recipientId") || "").slice(0, 80);
    const currencyParam = (searchParams.get("currency") || "").slice(0, 10);
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

    const whereAnd = [];
    if (fromDate || toDate) {
      const createdAt = {};
      if (fromDate) createdAt[Op.gte] = fromDate;
      if (toDate) createdAt[Op.lte] = toDate;
      whereAnd.push({ createdAt });
    }

    const allowedStatuses = [
      "pending",
      "completed",
      "failed",
      "cancelled",
      "refunded",
      "partially_refunded",
      "reversed",
    ];
    const status = allowedStatuses.includes(statusParam) ? statusParam : "";
    if (status) whereAnd.push({ status });

    const allowedTypes = ["payout", "transfer", "refund", "payment", "adjustment"];
    const type = allowedTypes.includes(typeParam) ? typeParam : "";
    if (type) whereAnd.push({ trans_type: type });

    if (recipientIdParam) whereAnd.push({ recipient_id: recipientIdParam });

    const currency = currencyParam
      ? String(currencyParam).trim().toUpperCase()
      : "";
    if (currency) whereAnd.push({ currency });

    if (q) {
      const like = `%${q}%`;
      whereAnd.push({
        [Op.or]: [
          { id: { [Op.iLike]: like } },
          { transaction_reference: { [Op.iLike]: like } },
          { gateway_reference: { [Op.iLike]: like } },
          { transaction_id: { [Op.iLike]: like } },
          { merchant_id: { [Op.iLike]: like } },
          { recipient_id: { [Op.iLike]: like } },
          { "$User.name$": { [Op.iLike]: like } },
          { "$User.email$": { [Op.iLike]: like } },
        ],
      });
    }

    const where = whereAnd.length ? { [Op.and]: whereAnd } : {};

    const toMajor = (n) => {
      const v = n != null ? Number(n) : NaN;
      if (!Number.isFinite(v)) return 0;
      return v / 100;
    };

    if (format === "csv") {
      const rows = await db.MarketplaceAdminTransactions.findAll({
        where,
        include: [
          {
            model: db.User,
            attributes: ["id", "name", "email", "image", "color"],
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
      });
      const header = [
        "id",
        "type",
        "recipient",
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
        lines.push([
          esc(tx.id),
          esc(tx.trans_type),
          esc(recipient),
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
          "Content-Disposition": `attachment; filename=transactions_${dateStr}.csv`,
        },
      });
    } else {
      const { rows, count } = await db.MarketplaceAdminTransactions.findAndCountAll({
        where,
        include: [
          {
            model: db.User,
            attributes: ["id", "name", "email", "image", "color"],
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset,
        distinct: true,
      });

      const data = (rows || []).map((r) => ({
        ...r.toJSON(),
        amount: toMajor(r.amount),
      }));

      return NextResponse.json({ status: "success", page, pageSize, total: count, data });
    }
  } catch (error) {
    await reportError(error, {
      route: "/api/admin/transactions",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "admin_transactions_list",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
