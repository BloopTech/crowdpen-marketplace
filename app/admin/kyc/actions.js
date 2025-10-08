"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";

function isAdminOrSenior(user) {
  return user?.role === "admin" || user?.role === "senior_admin";
}

export async function approveKyc(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }
  const kycId = String(formData.get("kycId") || "").trim();
  if (!kycId) return { success: false, message: "Missing kycId" };

  const record = await db.MarketplaceKycVerification.findOne({ where: { id: kycId } });
  if (!record) return { success: false, message: "KYC record not found" };

  await record.update({
    status: "approved",
    rejection_reason: null,
    reviewed_by: session.user.id,
    reviewed_at: new Date(),
  });

  revalidatePath("/admin/kyc");
  return { success: true, message: "KYC approved" };
}

export async function rejectKyc(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }
  const kycId = String(formData.get("kycId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!kycId) return { success: false, message: "Missing kycId" };

  const record = await db.MarketplaceKycVerification.findOne({ where: { id: kycId } });
  if (!record) return { success: false, message: "KYC record not found" };

  await record.update({
    status: "rejected",
    rejection_reason: reason || null,
    reviewed_by: session.user.id,
    reviewed_at: new Date(),
  });

  revalidatePath("/admin/kyc");
  return { success: true, message: "KYC rejected" };
}
