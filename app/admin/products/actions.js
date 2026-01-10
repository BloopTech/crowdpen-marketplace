"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { db } from "../../models";
import { revalidatePath } from "next/cache";
import { withServerActionErrorHandling } from "../../lib/observability/withServerActionErrorHandling";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

async function toggleFeaturedImpl(prevState, formData) {
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
}

export const toggleFeatured = withServerActionErrorHandling(toggleFeaturedImpl, {
  route: "/admin/products/toggleFeatured",
  method: "ACTION",
  tag: "admin_products",
  getContext: async () => {
    const session = await getServerSession(authOptions);
    return { userId: session?.user?.id || null };
  },
  onError: ({ error }) => {
    return { success: false, message: error?.message || "Failed" };
  },
});

async function toggleFlaggedImpl(prevState, formData) {
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
}

export const toggleFlagged = withServerActionErrorHandling(toggleFlaggedImpl, {
  route: "/admin/products/toggleFlagged",
  method: "ACTION",
  tag: "admin_products",
  getContext: async () => {
    const session = await getServerSession(authOptions);
    return { userId: session?.user?.id || null };
  },
  onError: ({ error }) => {
    return { success: false, message: error?.message || "Failed" };
  },
});
