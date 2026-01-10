"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";
import { withServerActionErrorHandling } from "../../lib/observability/withServerActionErrorHandling";

function isAdminOrSenior(user) {
  return user?.role === "admin" || user?.role === "senior_admin";
}

async function toggleMerchantImpl(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }

  const userId = String(formData.get("userId") || "").trim();
  const makeMerchant = String(formData.get("makeMerchant") || "").trim() === "true";
  if (!userId) return { success: false, message: "Missing userId" };

  if (userId === session.user.id) {
    return { success: false, message: "You cannot modify yourself here" };
  }

  const user = await db.User.findOne({ where: { id: userId } });
  if (!user) return { success: false, message: "User not found" };

  await user.update({ merchant: !!makeMerchant });
  revalidatePath("/admin/merchants");
  return { success: true, message: makeMerchant ? "Merchant enabled" : "Merchant removed" };
}

export const toggleMerchant = withServerActionErrorHandling(toggleMerchantImpl, {
  route: "/admin/merchants/toggleMerchant",
  method: "ACTION",
  tag: "admin_merchants",
  getContext: async () => {
    const session = await getServerSession(authOptions);
    return { userId: session?.user?.id || null };
  },
  onError: ({ error }) => {
    return { success: false, message: error?.message || "Failed" };
  },
});
