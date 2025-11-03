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

    const { id } = params || {};
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

    const data = {
      id: j.id,
      product_id: j.product_id,
      title: j.title,
      description: j.description,
      images: Array.isArray(j.images) ? j.images : (j.image ? [j.image] : []),
      image_alt: j.image_alt || null,
      featured: Boolean(j.featured),
      price: j.price != null ? Number(j.price) : null,
      originalPrice: j.originalPrice != null ? Number(j.originalPrice) : null,
      rating: Number(j.rating) || 0,
      authorRating: Number(j.authorRating) || 0,
      reviewCount: Number(j.reviewCount) || 0,
      downloads: Number(j.downloads) || 0,
      inStock: Boolean(j.inStock),
      fileType: j.fileType || null,
      fileSize: j.fileSize || null,
      license: j.license || null,
      deliveryTime: j.deliveryTime || null,
      lastUpdated: j.lastUpdated || j.updatedAt || null,
      createdAt: j.createdAt || null,
      what_included: j.what_included || null,
      file: j.file || null,
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
