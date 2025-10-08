"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";

function isAdminOrSenior(user) {
  return user?.role === "admin" || user?.role === "senior_admin";
}

export async function toggleMerchant(prevState, formData) {
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

  await user.update({ creator: !!makeMerchant });
  revalidatePath("/admin/merchants");
  return { success: true, message: makeMerchant ? "Merchant enabled" : "Merchant removed" };
}
