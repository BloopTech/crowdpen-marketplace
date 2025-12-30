import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { assertSafeExternalUrl } from "../../../../lib/security/ssrf";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";

const { MarketplaceOrderItems, MarketplaceOrder, MarketplaceProduct } = db;

function normalizeDownloadValue(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.toUpperCase() === "REVOKED") return "REVOKED";
  if (s === "#") return null;
  return s;
}

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    const idx = last.lastIndexOf(".");
    if (idx === -1) return null;
    const ext = last.slice(idx + 1).toLowerCase();
    return ext || null;
  } catch {
    return null;
  }
}

function extFromFileType(fileType) {
  const ft = (fileType || "").toString().trim().toUpperCase();
  const map = {
    PDF: "pdf",
    DOC: "doc",
    DOCX: "docx",
    XLS: "xls",
    XLSX: "xlsx",
    PPT: "ppt",
    PPTX: "pptx",
    ZIP: "zip",
    PSD: "psd",
    AI: "ai",
    FIG: "fig",
    FIGMA: "fig",
  };
  return map[ft] || null;
}

function contentTypeFromExt(ext) {
  const e = (ext || "").toLowerCase();
  const map = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
    psd: "image/vnd.adobe.photoshop",
    ai: "application/postscript",
  };
  return map[e] || "application/octet-stream";
}

function sanitizeFilenamePart(value) {
  const s = (value || "").toString().trim();
  const cleaned = s
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim();
  return cleaned || "download";
}

function buildFilename(itemName, productTitle, ext) {
  const base = sanitizeFilenamePart(itemName || productTitle || "download");
  if (!ext) return base;
  const lower = base.toLowerCase();
  return lower.endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function isOrderSuccessful(order) {
  const payment = (order?.paymentStatus || "").toString().toLowerCase();
  const status = (order?.orderStatus || "").toString().toLowerCase();
  return payment === "successful" || status === "successful";
}

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userId = String(session.user.id);
    const rl = rateLimit({ key: `download:${userId}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { orderItemId } = await params;
    const itemId = (orderItemId || "").toString().trim();
    if (!itemId) {
      return NextResponse.json(
        { status: "error", message: "Missing order item" },
        { status: 400 }
      );
    }

    const item = await MarketplaceOrderItems.findOne({
      where: { id: itemId },
      include: [
        {
          model: MarketplaceOrder,
          attributes: ["id", "user_id", "paymentStatus", "orderStatus"],
        },
        {
          model: MarketplaceProduct,
          attributes: ["id", "title", "file", "fileType"],
        },
      ],
    });

    if (!item) {
      return NextResponse.json(
        { status: "error", message: "Order item not found" },
        { status: 404 }
      );
    }

    const order = item?.MarketplaceOrder;
    if (!order || String(order.user_id) !== String(session.user.id)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!isOrderSuccessful(order)) {
      return NextResponse.json(
        { status: "error", message: "Order not paid" },
        { status: 403 }
      );
    }

    const normalized = normalizeDownloadValue(item.downloadUrl);
    if (normalized === "REVOKED") {
      return NextResponse.json(
        { status: "error", message: "License revoked" },
        { status: 403 }
      );
    }

    const product = item?.MarketplaceProduct;
    const fileUrl = normalized || (product?.file != null ? String(product.file).trim() : "");
    if (!fileUrl) {
      return NextResponse.json(
        { status: "error", message: "Download not available" },
        { status: 404 }
      );
    }

    let safeUrl;
    try {
      safeUrl = await assertSafeExternalUrl(fileUrl);
    } catch {
      return NextResponse.json(
        { status: "error", message: "Download not available" },
        { status: 404 }
      );
    }

    const upstream = await fetch(safeUrl.toString(), {
      redirect: "follow",
      cache: "no-store",
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { status: "error", message: "File not found" },
        { status: 404 }
      );
    }

    try {
      await item.increment("downloadCount", { by: 1 });
      await item.update({ lastDownloaded: new Date() });
    } catch (e) {
      console.error("download tracking update error", e);
    }

    const urlExt = getExtensionFromUrl(fileUrl);
    const ext = urlExt || extFromFileType(product?.fileType);
    const contentType =
      upstream.headers.get("content-type") || contentTypeFromExt(ext);

    const filename = buildFilename(item?.name, product?.title, ext);

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("/api/marketplace/download/[orderItemId] error", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Server error" : (error?.message || "Server error"),
      },
      { status: 500 }
    );
  }
}
