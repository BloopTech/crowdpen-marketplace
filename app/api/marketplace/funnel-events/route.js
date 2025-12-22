import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

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

const funnelEventSchema = z.object({
  event_name: z.enum([
    "visit",
    "product_view",
    "add_to_cart",
    "checkout_started",
    "paid",
  ]),
  occurred_at: z.string().datetime().optional(),
  session_id: z.string().trim().min(8).max(128).optional().nullable(),
  marketplace_product_id: z.string().uuid().optional().nullable(),
  marketplace_order_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = funnelEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid request",
          details: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);

    const occurredAt = parsed.data.occurred_at
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
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed" },
      { status: 500 }
    );
  }
}
