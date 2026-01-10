"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";
import { withServerActionErrorHandling } from "../../lib/observability/withServerActionErrorHandling";

function isAdminOrSenior(user) {
  return user?.role === "admin" || user?.role === "senior_admin";
}

async function revokeLicenseImpl(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }

  const itemId = String(formData.get("orderItemId") || "").trim();
  if (!itemId) return { success: false, message: "Missing orderItemId" };

  const item = await db.MarketplaceOrderItems.findOne({ where: { id: itemId } });
  if (!item) return { success: false, message: "Order item not found" };

  await item.update({ downloadUrl: "REVOKED" });
  revalidatePath("/admin/licenses");
  return { success: true, message: "License revoked" };
}

export const revokeLicense = withServerActionErrorHandling(revokeLicenseImpl, {
  route: "/admin/licenses/revokeLicense",
  method: "ACTION",
  tag: "admin_licenses",
  getContext: async () => {
    const session = await getServerSession(authOptions);
    return { userId: session?.user?.id || null };
  },
  onError: ({ error }) => {
    return { success: false, message: error?.message || "Failed" };
  },
});
