import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import {
  getRequestIdFromHeaders,
  reportError,
} from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

function sanitizeString(value, maxLen) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeNumber(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function sanitizeDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildDraftUpdate(input) {
  const out = {};

  if (Object.prototype.hasOwnProperty.call(input, "draft_key")) {
    out.draft_key = sanitizeString(input.draft_key, 200);
  }

  if (Object.prototype.hasOwnProperty.call(input, "title")) {
    out.title = sanitizeString(input.title, 200);
  }
  if (Object.prototype.hasOwnProperty.call(input, "description")) {
    out.description = sanitizeString(input.description, 20000);
  }

  if (Object.prototype.hasOwnProperty.call(input, "price")) {
    out.price = sanitizeNumber(input.price);
  }
  if (Object.prototype.hasOwnProperty.call(input, "currency")) {
    out.currency = sanitizeString(input.currency, 8);
  }
  if (Object.prototype.hasOwnProperty.call(input, "originalPrice")) {
    out.originalPrice = sanitizeNumber(input.originalPrice);
  }

  if (Object.prototype.hasOwnProperty.call(input, "sale_end_date")) {
    out.sale_end_date = sanitizeDate(input.sale_end_date);
  }

  if (Object.prototype.hasOwnProperty.call(input, "marketplace_category_id")) {
    out.marketplace_category_id = sanitizeString(input.marketplace_category_id, 80);
  }

  if (Object.prototype.hasOwnProperty.call(input, "marketplace_subcategory_id")) {
    out.marketplace_subcategory_id = sanitizeString(
      input.marketplace_subcategory_id,
      80
    );
  }

  if (Object.prototype.hasOwnProperty.call(input, "product_status")) {
    const s = sanitizeString(input.product_status, 20);
    if (s && ["draft", "published", "archived"].includes(s)) {
      out.product_status = s;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "stock")) {
    const n = sanitizeNumber(input.stock);
    out.stock = n == null ? null : Math.max(0, Math.floor(n));
  }

  if (Object.prototype.hasOwnProperty.call(input, "image")) {
    out.image = sanitizeString(input.image, 2000);
  }
  if (Object.prototype.hasOwnProperty.call(input, "images")) {
    if (Array.isArray(input.images)) {
      out.images = input.images
        .map((v) => sanitizeString(v, 2000))
        .filter(Boolean)
        .slice(0, 20);
    } else {
      out.images = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "file")) {
    out.file = sanitizeString(input.file, 2000);
  }
  if (Object.prototype.hasOwnProperty.call(input, "fileType")) {
    out.fileType = sanitizeString(input.fileType, 50);
  }
  if (Object.prototype.hasOwnProperty.call(input, "fileSize")) {
    out.fileSize = sanitizeString(input.fileSize, 50);
  }
  if (Object.prototype.hasOwnProperty.call(input, "license")) {
    out.license = sanitizeString(input.license, 100);
  }
  if (Object.prototype.hasOwnProperty.call(input, "deliveryTime")) {
    out.deliveryTime = sanitizeString(input.deliveryTime, 100);
  }
  if (Object.prototype.hasOwnProperty.call(input, "what_included")) {
    out.what_included = sanitizeString(input.what_included, 20000);
  }

  return out;
}

function serializeDraft(draft) {
  if (!draft) return null;
  const d = draft?.toJSON ? draft.toJSON() : draft;
  return {
    id: d.id,
    draft_key: d.draft_key,
    title: d.title,
    description: d.description,
    price: d.price,
    currency: d.currency,
    originalPrice: d.originalPrice,
    sale_end_date: d.sale_end_date,
    marketplace_category_id: d.marketplace_category_id,
    marketplace_subcategory_id: d.marketplace_subcategory_id,
    product_status: d.product_status,
    stock: d.stock,
    image: d.image,
    images: d.images,
    file: d.file,
    fileType: d.fileType,
    fileSize: d.fileSize,
    license: d.license,
    deliveryTime: d.deliveryTime,
    what_included: d.what_included,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;

  try {
    session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    if (!userId) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitRaw = Number.parseInt(searchParams.get("limit") || "10", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;

    const drafts = await db.MarketplaceProductDraft.findAll({
      where: { user_id: userId },
      order: [["updatedAt", "DESC"]],
      limit,
    });

    return NextResponse.json({
      status: "success",
      drafts: drafts.map(serializeDraft),
    });
  } catch (error) {
    await reportError(error, {
      tag: "product_drafts_list",
      route: "/api/marketplace/products/drafts",
      method: "GET",
      requestId,
      userId: session?.user?.id || null,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to fetch drafts" : error?.message || "Failed to fetch drafts",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;

  try {
    session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    if (!userId) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const draftKey = sanitizeString(body?.draft_key, 200);
    const update = buildDraftUpdate(body || {});

    let draft = null;

    if (draftKey) {
      draft = await db.MarketplaceProductDraft.findOne({
        where: {
          user_id: userId,
          draft_key: draftKey,
        },
      });
    }

    if (!draft) {
      draft = await db.MarketplaceProductDraft.create({
        user_id: userId,
        draft_key: draftKey,
        ...update,
      });
    } else {
      await draft.update(update);
    }

    return NextResponse.json({
      status: "success",
      draft: serializeDraft(draft),
    });
  } catch (error) {
    await reportError(error, {
      tag: "product_draft_upsert",
      route: "/api/marketplace/products/drafts",
      method: "POST",
      requestId,
      userId: session?.user?.id || null,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to save draft" : error?.message || "Failed to save draft",
      },
      { status: 500 }
    );
  }
}
