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
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format") || "json";
    const pageSize = Math.min(Math.max(limitParam, 1), 100);
    const page = Math.max(pageParam, 1);
    const offset = (page - 1) * pageSize;

    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    if (format === "csv") {
      const rows = await db.MarketplaceAdminTransactions.findAll({
        where,
        include: [{ model: db.User, attributes: ["id", "name", "email", "image", "color"] }],
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
          esc(tx.amount),
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
          { model: db.User, attributes: ["id", "name", "email", "image", "color"] },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset,
      });

      return NextResponse.json({ status: "success", page, pageSize, total: count, data: rows });
    }
  } catch (error) {
    console.error("/api/admin/transactions error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
