"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { db } from "../../models";
import { revalidatePath } from "next/cache";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

export async function toggleFeatured(prevState, formData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return { success: false, message: "Unauthorized" };
    }

    const id = String(formData.get("id") || "").trim();
    const featuredStr = String(formData.get("featured") || "").trim();
    const featured = featuredStr === "true" || featuredStr === "1";
    if (!id) return { success: false, message: "Missing id" };

    const product = await db.MarketplaceProduct.findOne({ where: { id } });
    if (!product) return { success: false, message: "Product not found" };

    await product.update({ featured });
    revalidatePath("/admin/products");
    return { success: true, id, featured };
  } catch (e) {
    return { success: false, message: e?.message || "Failed" };
  }
}

export async function toggleFlagged(prevState, formData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return { success: false, message: "Unauthorized" };
    }

    const id = String(formData.get("id") || "").trim();
    const flaggedStr = String(formData.get("flagged") || "").trim();
    const flagged = flaggedStr === "true" || flaggedStr === "1";
    if (!id) return { success: false, message: "Missing id" };

    const product = await db.MarketplaceProduct.findOne({ where: { id } });
    if (!product) return { success: false, message: "Product not found" };

    await product.update({ flagged });
    revalidatePath("/admin/products");
    return { success: true, id, flagged };
  } catch (e) {
    return { success: false, message: e?.message || "Failed" };
  }
}
