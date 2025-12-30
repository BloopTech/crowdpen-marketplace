import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { v4 as uuidv4 } from "uuid";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";

export const dynamic = "force-dynamic";

const SESSION_KEY = "cp_marketplace_session_id_v1";

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = String(cookieHeader).split(";");
  for (const p of parts) {
    const [k, ...rest] = String(p).trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("=") || "");
  }
  return null;
}

function normalizeSessionId(v) {
  const s = v == null ? "" : String(v).trim();
  if (s.length < 8 || s.length > 128) return null;
  return s;
}

function isLocalhostRequest(request) {
  const host = (request?.headers?.get("host") || "").toLowerCase();
  if (!host) return false;
  const directLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");
  const isLocalEnv = process.env.NODE_ENV !== "production";
  return isLocalEnv && directLocal;
}

const ALLOWED_EVENTS = new Set([
  "visit",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "paid",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateEventPayload(body) {
  const data = body && typeof body === "object" ? body : {};
  const errors = [];
  const safe = {};

  if (!ALLOWED_EVENTS.has(data.event_name)) {
    errors.push({
      path: ["event_name"],
      message: "event_name must be one of visit, product_view, add_to_cart, checkout_started, paid",
    });
  } else {
    safe.event_name = data.event_name;
  }

  if (data.occurred_at != null) {
    const str = String(data.occurred_at);
    const date = new Date(str);
    if (!Number.isFinite(date.getTime())) {
      errors.push({ path: ["occurred_at"], message: "occurred_at must be an ISO date string" });
    } else {
      safe.occurred_at = str;
    }
  }

  const sessionId = data.session_id == null ? null : normalizeSessionId(data.session_id);
  if (sessionId === null && data.session_id != null) {
    errors.push({
      path: ["session_id"],
      message: "session_id must be 8-128 chars",
    });
  } else {
    safe.session_id = sessionId;
  }

  const mpId = data.marketplace_product_id == null ? null : String(data.marketplace_product_id).trim();
  if (mpId && !UUID_REGEX.test(mpId)) {
    errors.push({
      path: ["marketplace_product_id"],
      message: "marketplace_product_id must be a valid UUID",
    });
  } else {
    safe.marketplace_product_id = mpId;
  }

  const orderId = data.marketplace_order_id == null ? null : String(data.marketplace_order_id).trim();
  if (orderId && !UUID_REGEX.test(orderId)) {
    errors.push({
      path: ["marketplace_order_id"],
      message: "marketplace_order_id must be a valid UUID",
    });
  } else {
    safe.marketplace_order_id = orderId;
  }

  const metadata = data.metadata ?? null;
  if (
    metadata !== null &&
    (typeof metadata !== "object" || Array.isArray(metadata))
  ) {
    errors.push({
      path: ["metadata"],
      message: "metadata must be an object",
    });
  } else {
    safe.metadata = metadata;
  }

  return errors.length
    ? { success: false, errors }
    : { success: true, data: safe };
}

export async function POST(request) {
  try {
    if (isLocalhostRequest(request)) {
      return new NextResponse(null, { status: 204 });
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({ key: `funnel-events:${ip}`, limit: 600, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = validateEventPayload(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid request",
          details: parsed.errors,
        },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);

    const occurredAt = parsed.data?.occurred_at
      ? new Date(parsed.data.occurred_at)
      : new Date();
    if (!Number.isFinite(occurredAt.getTime())) {
      return NextResponse.json(
        { status: "error", message: "Invalid occurred_at" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const occurredMs = occurredAt.getTime();
    if (occurredMs > now + 5 * 60 * 1000) {
      return NextResponse.json(
        { status: "error", message: "occurred_at is in the future" },
        { status: 400 }
      );
    }

    if (occurredMs < now - 90 * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { status: "error", message: "occurred_at is too old" },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const userId = session?.user?.id || null;

    const cookieHeader = request?.headers?.get("cookie") || "";
    const cookieSessionId = normalizeSessionId(
      getCookieValue(cookieHeader, SESSION_KEY)
    );
    const bodySessionId = normalizeSessionId(parsed.data.session_id);

    const resolvedSessionId = userId
      ? String(userId)
      : cookieSessionId || bodySessionId || null;

    const metadata = parsed.data.metadata ?? null;
    const metadataJson = metadata == null ? null : JSON.stringify(metadata);

    if (metadataJson && metadataJson.length > 25_000) {
      return NextResponse.json(
        { status: "error", message: "metadata is too large" },
        { status: 413 }
      );
    }

    await db.sequelize.query(
      `INSERT INTO "marketplace_funnel_events" (
        "id",
        "event_name",
        "occurred_at",
        "session_id",
        "user_id",
        "marketplace_product_id",
        "marketplace_order_id",
        "metadata"
      ) VALUES (
        :id,
        :event_name,
        :occurred_at,
        :session_id,
        :user_id,
        :marketplace_product_id,
        :marketplace_order_id,
        :metadata::jsonb
      )`,
      {
        replacements: {
          id,
          event_name: parsed.data.event_name,
          occurred_at: occurredAt,
          session_id: resolvedSessionId,
          user_id: userId,
          marketplace_product_id: parsed.data.marketplace_product_id ?? null,
          marketplace_order_id: parsed.data.marketplace_order_id ?? null,
          metadata: metadataJson,
        },
        type: db.Sequelize.QueryTypes.INSERT,
      }
    );

    return NextResponse.json({ status: "success", id });
  } catch (error) {
    console.error("/api/marketplace/funnel-events error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Failed" : (error?.message || "Failed") },
      { status: 500 }
    );
  }
}
