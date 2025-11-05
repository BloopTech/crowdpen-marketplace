import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { Op } from "sequelize";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

export async function GET(_request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params || {};
    const pid = String(id || "").trim();
    if (!pid) {
      return NextResponse.json({ status: "error", message: "Missing id" }, { status: 400 });
    }

    const product = await db.MarketplaceProduct.findOne({
      where: {
        [Op.or]: [{ id: pid }, { product_id: pid }],
      },
      include: [
        { model: db.MarketplaceCategory, attributes: ["id", "name"], required: false },
        { model: db.MarketplaceSubCategory, attributes: ["id", "name"], required: false },
        {
          model: db.User,
          attributes: ["id", "name", "email", "image", "pen_name", "role"],
          required: false,
          include: [
            {
              model: db.MarketplaceKycVerification,
              attributes: ["status"],
              required: false,
            },
          ],
        },
        { model: db.MarketplaceProductTags, as: "productTags", required: false },
      ],
    });

    if (!product) {
      return NextResponse.json({ status: "error", message: "Product not found" }, { status: 404 });
    }

    const j = product.toJSON();
    // Aggregate units sold and total revenue from completed orders
    const [agg] = await db.sequelize.query(
      `SELECT
         COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",
         COALESCE(SUM((oi."subtotal")::numeric), 0) AS "totalRevenue"
       FROM "marketplace_order_items" AS oi
       JOIN "marketplace_orders" AS o ON o."id" = oi."marketplace_order_id"
       WHERE oi."marketplace_product_id" = :pid
         AND o."paymentStatus" = 'completed'`,
      { replacements: { pid: j.id }, type: db.Sequelize.QueryTypes.SELECT }
    );

    // Parse optional fee rates from env (% provided as '0.2' or '20')
    const parsePct = (v) => {
      if (v == null || v === "") return 0;
      const n = Number(String(v).replace(/%/g, ""));
      if (!isFinite(n) || isNaN(n)) return 0;
      return n > 1 ? n / 100 : n; // accept 20 => 0.2
    };
    const CROWD_PCT = parsePct(process.env.CROWDPEN_FEE_PCT || process.env.CROWD_PEN_FEE_PCT || process.env.PLATFORM_FEE_PCT);
    const SB_PCT = parsePct(process.env.STARTBUTTON_FEE_PCT || process.env.START_BUTTON_FEE_PCT || process.env.GATEWAY_FEE_PCT);
    const revenue = Number(agg?.totalRevenue || 0) || 0;
    const crowdpenFee = revenue * (CROWD_PCT || 0);
    const startbuttonFee = revenue * (SB_PCT || 0);
    const creatorPayout = Math.max(0, revenue - crowdpenFee - startbuttonFee);

    const fileUrl = typeof j.file === "string" && j.file.trim() ? j.file : null;
    let fileName = null;
    let fileExtension = null;
    if (fileUrl) {
      try {
        const parsed = new URL(fileUrl);
        const lastSegment = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
        if (lastSegment) {
          fileName = lastSegment;
        }
      } catch (error) {
        const fallbackSegment = decodeURIComponent(fileUrl.split("/").pop() || "");
        if (fallbackSegment) {
          fileName = fallbackSegment;
        }
      }

      if (fileName) {
        const parts = fileName.split(".");
        if (parts.length > 1) {
          fileExtension = parts.pop().toLowerCase();
        }
      }
    }

    const data = {
      id: j.id,
      product_id: j.product_id,
      title: j.title,
      description: j.description,
      images: Array.isArray(j.images) ? j.images : (j.image ? [j.image] : []),
      image_alt: j.image_alt || null,
      featured: Boolean(j.featured),
      flagged: Boolean(j.flagged),
      price: j.price != null ? Number(j.price) : null,
      originalPrice: j.originalPrice != null ? Number(j.originalPrice) : null,
      rating: Number(j.rating) || 0,
      authorRating: Number(j.authorRating) || 0,
      reviewCount: Number(j.reviewCount) || 0,
      downloads: Number(j.downloads) || 0,
      inStock: Boolean(j.inStock),
      unitsSold: Number(agg?.unitsSold || 0) || 0,
      totalRevenue: revenue,
      crowdpenFee,
      startbuttonFee,
      creatorPayout,
      fileType: j.fileType || null,
      fileSize: j.fileSize || null,
      license: j.license || null,
      deliveryTime: j.deliveryTime || null,
      lastUpdated: j.lastUpdated || j.updatedAt || null,
      createdAt: j.createdAt || null,
      what_included: j.what_included || null,
      file: fileUrl,
      fileUrl,
      fileName,
      fileExtension,
      category: j.MarketplaceCategory ? { id: j.MarketplaceCategory.id, name: j.MarketplaceCategory.name } : null,
      subcategory: j.MarketplaceSubCategory ? { id: j.MarketplaceSubCategory.id, name: j.MarketplaceSubCategory.name } : null,
      owner: j.User
        ? {
            id: j.User.id,
            pen_name: j.User.pen_name,
            name: j.User.name,
            email: j.User.email,
            image: j.User.image,
            role: j.User.role,
            kycStatus: j.User.MarketplaceKycVerification?.status || null,
          }
        : null,
      tags: Array.isArray(j.productTags)
        ? j.productTags.map((t) => ({ id: t.id, tag_id: t.marketplace_tag_id, label: t.label || t.name || String(t.marketplace_tag_id) }))
        : [],
    };

    return NextResponse.json({ status: "success", data });
  } catch (error) {
    console.error("/api/admin/products/[id] GET error", error);
    return NextResponse.json({ status: "error", message: error?.message || "Failed" }, { status: 500 });
  }
}
