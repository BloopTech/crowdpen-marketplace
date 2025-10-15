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
    return {
      success: false,
      message: "Unauthorized",
      error: { session },
      data: {},
    };
  }
  const kycId = String(formData.get("kycId") || "").trim();
  if (!kycId)
    return {
      success: false,
      message: "Missing kycId",
      error: { kycId },
      data: {},
    };

  const record = await db.MarketplaceKycVerification.findOne({
    where: { id: kycId },
  });
  if (!record)
    return {
      success: false,
      message: "KYC record not found",
      data: {},
      error: { kycId },
    };

  await record.update({
    status: "approved",
    rejection_reason: null,
    reviewed_by: session.user.id,
    reviewed_at: new Date(),
  });

  // Auto-promote user to merchant upon KYC approval
  if (record?.user_id) {
    await db.User.update({ merchant: true }, { where: { id: record.user_id } });
  }

  // Revalidate merchants page so the newly promoted user appears there
  revalidatePath("/admin/merchants");

  revalidatePath("/admin/kyc");
  return { success: true, message: "KYC approved", data: record, error: {} };
}

export async function rejectKyc(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return {
      success: false,
      message: "Unauthorized",
      error: { session },
      data: {},
    };
  }
  const kycId = String(formData.get("kycId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!kycId)
    return {
      success: false,
      message: "Missing kycId",
      error: { kycId },
      data: {},
    };

  const record = await db.MarketplaceKycVerification.findOne({
    where: { id: kycId },
  });
  if (!record)
    return {
      success: false,
      message: "KYC record not found",
      data: {},
      error: { kycId },
    };

  await record.update({
    status: "rejected",
    rejection_reason: reason || null,
    reviewed_by: session.user.id,
    reviewed_at: new Date(),
  });

  revalidatePath("/admin/kyc");
  return { success: true, message: "KYC rejected", error: {}, data: record };
}
