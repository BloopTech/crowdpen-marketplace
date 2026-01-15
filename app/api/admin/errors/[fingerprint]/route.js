import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

function normalizeFingerprint(value) {
  const s = String(value || "").trim();
  if (!/^[0-9a-f]{64}$/i.test(s)) return null;
  return s.toLowerCase();
}

export async function GET(request, { params }) {
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

    let fingerprint;
    try {
      ({ fingerprint } = (await params) || {});
    } catch {
      fingerprint = null;
    }
    const fp = normalizeFingerprint(fingerprint);
    if (!fp) {
      return NextResponse.json(
        { status: "error", message: "Invalid fingerprint" },
        { status: 400 }
      );
    }

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
         sample_context,
         last_request_id,
         last_user_id
       FROM public.marketplace_error_events
       WHERE fingerprint = :fp
       LIMIT 1`,
      { replacements: { fp }, type: db.Sequelize.QueryTypes.SELECT }
    );

    const row = rows?.[0] || null;
    if (!row) {
      return NextResponse.json(
        { status: "error", message: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "success", data: row });
  } catch (error) {
    await reportError(error, {
      route: "/api/admin/errors/[fingerprint]",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "admin_errors_get",
    });

    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
