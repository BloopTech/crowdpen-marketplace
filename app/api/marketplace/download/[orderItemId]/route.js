import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { assertSafeExternalUrl } from "../../../../lib/security/ssrf";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

const { MarketplaceOrderItems, MarketplaceOrder, MarketplaceProduct } = db;

export const runtime = "nodejs";

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

function isOrderBlocked(order) {
  const payment = (order?.paymentStatus || "").toString().toLowerCase();
  const status = (order?.orderStatus || "").toString().toLowerCase();
  return payment === "failed" || payment === "refunded" || status === "failed" || status === "cancelled";
}

function getOrderCollectionStage(order) {
  if (!order) return null;
  if (isOrderSuccessful(order)) return "completed";
  const provider = (order?.payment_provider || "").toString().trim().toLowerCase();
  if (provider !== "startbutton") return null;
  const notes = (order?.notes || "").toString();
  if (!notes) return null;
  const matches = Array.from(notes.matchAll(/\bstage=([a-zA-Z_]+)\b/g));
  const last = matches.length ? matches[matches.length - 1] : null;
  const stage = last?.[1] ? String(last[1]).trim().toLowerCase() : "";
  return stage || null;
}

function getUserAgent(request) {
  try {
    const ua = request?.headers?.get("user-agent") || "";
    const s = ua.toString().trim();
    return s || null;
  } catch {
    return null;
  }
}

async function writeDownloadEvent({
  userId,
  ip,
  userAgent,
  order,
  orderItemId,
  productId,
  stage,
  allowed,
  denyReason,
  downloadCountBefore,
  downloadCountAfter,
}) {
  if (!userId) return;
  try {
    await db.sequelize.query(
      `
        INSERT INTO public.marketplace_download_events (
          user_id,
          marketplace_order_id,
          marketplace_order_item_id,
          marketplace_product_id,
          payment_provider,
          payment_stage,
          order_payment_status,
          order_order_status,
          allowed,
          deny_reason,
          download_count_before,
          download_count_after,
          ip,
          user_agent
        )
        VALUES (
          :userId,
          :orderId,
          :orderItemId,
          :productId,
          :paymentProvider,
          :paymentStage,
          :orderPaymentStatus,
          :orderOrderStatus,
          :allowed,
          :denyReason,
          :downloadCountBefore,
          :downloadCountAfter,
          :ip,
          :userAgent
        )
      `,
      {
        replacements: {
          userId,
          orderId: order?.id || null,
          orderItemId: orderItemId || null,
          productId: productId || null,
          paymentProvider: order?.payment_provider || null,
          paymentStage: stage || null,
          orderPaymentStatus: order?.paymentStatus || null,
          orderOrderStatus: order?.orderStatus || null,
          allowed: allowed === true,
          denyReason: denyReason || null,
          downloadCountBefore:
            Number.isFinite(downloadCountBefore) ? downloadCountBefore : null,
          downloadCountAfter:
            Number.isFinite(downloadCountAfter) ? downloadCountAfter : null,
          ip: ip || null,
          userAgent: userAgent || null,
        },
        type: db.Sequelize.QueryTypes.INSERT,
      }
    );
  } catch (e) {
    const code = e?.original?.code || e?.code;
    if (code === "42P01") return;
  }
}

async function maybeWatermarkVerifiedPdf({ bytes, watermarkText, maxPages }) {
  const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const pdf = await PDFDocument.load(raw);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const lim = Number.isFinite(Number(maxPages)) ? Math.max(0, Math.floor(Number(maxPages))) : 20;
  const count = lim > 0 ? Math.min(pages.length, lim) : pages.length;
  for (let i = 0; i < count; i++) {
    const page = pages[i];
    const { height } = page.getSize();
    page.drawText(watermarkText, {
      x: 24,
      y: height / 2,
      size: 14,
      font,
      color: rgb(0.35, 0.35, 0.35),
      rotate: degrees(-35),
      opacity: 0.18,
    });
  }
  return await pdf.save();
}

export async function GET(request, { params }) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userId = String(session.user.id);
    const userAgent = getUserAgent(request);
    const rl = rateLimit({ key: `download:${userId}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    let orderItemId;
    try {
      ({ orderItemId } = await params);
    } catch {
      orderItemId = null;
    }
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
          attributes: [
            "id",
            "user_id",
            "order_number",
            "paymentStatus",
            "orderStatus",
            "payment_provider",
            "notes",
          ],
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
      await writeDownloadEvent({
        userId,
        ip,
        userAgent,
        order,
        orderItemId: item?.id || itemId,
        productId: item?.MarketplaceProduct?.id || null,
        stage: getOrderCollectionStage(order),
        allowed: false,
        denyReason: "unauthorized",
      });
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (isOrderBlocked(order)) {
      await writeDownloadEvent({
        userId,
        ip,
        userAgent,
        order,
        orderItemId: item?.id || itemId,
        productId: item?.MarketplaceProduct?.id || null,
        stage: getOrderCollectionStage(order),
        allowed: false,
        denyReason: "order_blocked",
      });
      return NextResponse.json(
        { status: "error", message: "Order not paid" },
        { status: 403 }
      );
    }

    const stage = getOrderCollectionStage(order);
    const allowVerifiedDownload = stage === "verified";
    const maxVerifiedDownloadsRaw = process.env.STARTBUTTON_VERIFIED_DOWNLOAD_LIMIT;
    const maxVerifiedDownloads = Number.isFinite(Number(maxVerifiedDownloadsRaw))
      ? Math.max(0, Math.floor(Number(maxVerifiedDownloadsRaw)))
      : 3;

    if (!isOrderSuccessful(order) && !allowVerifiedDownload) {
      await writeDownloadEvent({
        userId,
        ip,
        userAgent,
        order,
        orderItemId: item?.id || itemId,
        productId: item?.MarketplaceProduct?.id || null,
        stage,
        allowed: false,
        denyReason: "not_paid",
      });
      return NextResponse.json(
        { status: "error", message: "Order not paid" },
        { status: 403 }
      );
    }

    if (allowVerifiedDownload) {
      const n = item?.downloadCount != null ? Number(item.downloadCount) : 0;
      if (Number.isFinite(n) && maxVerifiedDownloads > 0 && n >= maxVerifiedDownloads) {
        await writeDownloadEvent({
          userId,
          ip,
          userAgent,
          order,
          orderItemId: item?.id || itemId,
          productId: item?.MarketplaceProduct?.id || null,
          stage,
          allowed: false,
          denyReason: "download_limit",
          downloadCountBefore: n,
          downloadCountAfter: n,
        });
        return NextResponse.json(
          {
            status: "error",
            message: "Download limit reached until payment settles",
          },
          { status: 403 }
        );
      }
    }

    const normalized = normalizeDownloadValue(item.downloadUrl);
    if (normalized === "REVOKED") {
      await writeDownloadEvent({
        userId,
        ip,
        userAgent,
        order,
        orderItemId: item?.id || itemId,
        productId: item?.MarketplaceProduct?.id || null,
        stage,
        allowed: false,
        denyReason: "license_revoked",
      });
      return NextResponse.json(
        { status: "error", message: "License revoked" },
        { status: 403 }
      );
    }

    const product = item?.MarketplaceProduct;
    const fileUrl = normalized || (product?.file != null ? String(product.file).trim() : "");
    if (!fileUrl) {
      await writeDownloadEvent({
        userId,
        ip,
        userAgent,
        order,
        orderItemId: item?.id || itemId,
        productId: product?.id || null,
        stage,
        allowed: false,
        denyReason: "file_missing",
      });
      return NextResponse.json(
        { status: "error", message: "Download not available" },
        { status: 404 }
      );
    }

    const urlExt = getExtensionFromUrl(fileUrl);
    const ext = urlExt || extFromFileType(product?.fileType);

    let safeUrl;
    try {
      safeUrl = await assertSafeExternalUrl(fileUrl);
    } catch {
      await writeDownloadEvent({
        userId,
        ip,
        userAgent,
        order,
        orderItemId: item?.id || itemId,
        productId: product?.id || null,
        stage,
        allowed: false,
        denyReason: "ssrf_blocked",
      });
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
      await writeDownloadEvent({
        userId,
        ip,
        userAgent,
        order,
        orderItemId: item?.id || itemId,
        productId: product?.id || null,
        stage,
        allowed: false,
        denyReason: "upstream_not_ok",
      });
      return NextResponse.json(
        { status: "error", message: "File not found" },
        { status: 404 }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || contentTypeFromExt(ext);

    const countBefore = item?.downloadCount != null ? Number(item.downloadCount) : 0;
    const countAfter = Number.isFinite(countBefore) ? countBefore + 1 : null;

    try {
      await item.increment("downloadCount", { by: 1 });
      await item.update({ lastDownloaded: new Date() });

      if (product?.id) {
        await MarketplaceProduct.increment(
          { downloads: 1 },
          { where: { id: product.id } }
        );
      }
    } catch (e) {
      await reportError(e, {
        route: "/api/marketplace/download/[orderItemId]",
        method: "GET",
        status: 200,
        requestId,
        userId: session?.user?.id || null,
        tag: "download_tracking_update",
      });
    }

    const filename = buildFilename(item?.name, product?.title, ext);

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    let body = upstream.body;
    let bodyStatus = 200;
    if (allowVerifiedDownload && String(ext || "").toLowerCase() === "pdf") {
      const watermarkOn =
        String(process.env.STARTBUTTON_WATERMARK_VERIFIED_DOWNLOADS || "true")
          .toString()
          .trim()
          .toLowerCase() !== "false";
      if (watermarkOn) {
        const raw = await upstream.arrayBuffer();
        const orderNumber = order?.order_number ? String(order.order_number).trim() : "";
        const email = (session?.user?.email || "").toString().trim();
        const line = ["CrowdPen", "Verified", orderNumber, email]
          .filter(Boolean)
          .join(" | ");
        const maxPagesRaw = process.env.STARTBUTTON_WATERMARK_MAX_PAGES;

        try {
          const pdfBytes = await maybeWatermarkVerifiedPdf({
            bytes: raw,
            watermarkText: line || "CrowdPen Verified",
            maxPages: maxPagesRaw,
          });
          body = pdfBytes;
        } catch (e) {
          body = raw;
          await reportError(e, {
            route: "/api/marketplace/download/[orderItemId]",
            method: "GET",
            status: 200,
            requestId,
            userId: session?.user?.id || null,
            tag: "download_watermark_failed",
          });
        }

        headers.delete("Content-Length");
        headers.set("Content-Type", "application/pdf");
      }
    }

    await writeDownloadEvent({
      userId,
      ip,
      userAgent,
      order,
      orderItemId: item?.id || itemId,
      productId: product?.id || null,
      stage,
      allowed: true,
      denyReason: null,
      downloadCountBefore: Number.isFinite(countBefore) ? countBefore : null,
      downloadCountAfter: Number.isFinite(countAfter) ? countAfter : null,
    });

    return new Response(body, { status: bodyStatus, headers });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/download/[orderItemId]",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "download_file",
    });
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
