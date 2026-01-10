import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
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
    const q = (searchParams.get("q") || "").trim().slice(0, 200);
    const fromParam = (searchParams.get("from") || "").slice(0, 100);
    const toParam = (searchParams.get("to") || "").slice(0, 100);

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

    const whereParts = [];
    const replacements = {
      q: q ? `%${q}%` : null,
      limit: pageSize,
      offset,
      from: fromDate,
      to: toDate,
    };

    if (q) {
      whereParts.push(
        `(
          fingerprint ILIKE :q OR
          COALESCE(route,'') ILIKE :q OR
          COALESCE(method,'') ILIKE :q OR
          COALESCE(error_name,'') ILIKE :q OR
          COALESCE(pg_code,'') ILIKE :q OR
          COALESCE(constraint_name,'') ILIKE :q OR
          COALESCE(sample_message,'') ILIKE :q
        )`
      );
    }

    if (fromDate) {
      whereParts.push(`last_seen_at >= :from`);
    }

    if (toDate) {
      whereParts.push(`last_seen_at <= :to`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [countRow] = await db.sequelize.query(
      `SELECT COUNT(*)::bigint AS total
       FROM public.marketplace_error_events
       ${whereSql}`,
      { replacements, type: db.Sequelize.QueryTypes.SELECT }
    );

    const rows = await db.sequelize.query(
      `SELECT
         fingerprint,
         first_seen_at,
         last_seen_at,
         event_count,
         route,
         method,
         status,
         error_name,
         pg_code,
         constraint_name,
         sample_message,
         sample_stack,
         last_request_id,
         last_user_id
       FROM public.marketplace_error_events
       ${whereSql}
       ORDER BY last_seen_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: db.Sequelize.QueryTypes.SELECT }
    );

    return NextResponse.json({
      status: "success",
      page,
      pageSize,
      total: Number(countRow?.total || 0) || 0,
      data: rows,
    });
  } catch (error) {
    await reportError(error, {
      route: "/api/admin/errors",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "admin_errors_list",
    });

    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
