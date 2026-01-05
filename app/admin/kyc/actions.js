"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";
import { render } from "@react-email/render";
import KycApproved from "../../emails/KycApproved";
import KycRejected from "../../emails/KycRejected";
import { sendEmail } from "../../lib/sendEmail";

function isAdminOrSenior(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
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
    const user = await db.User.findOne({
      where: { id: record.user_id },
      attributes: ["id", "role", "crowdpen_staff"],
    });
    if (user && !isAdminOrSenior(user)) {
      await db.User.update({ merchant: true }, { where: { id: record.user_id } });
    }
  }

  // Send approval email (best-effort)
  let emailInfo = { sent: false, error: null };
  try {
    if (record?.user_id) {
      const user = await db.User.findOne({
        where: { id: record.user_id },
        attributes: ["id", "name", "email"],
      });
      const to = user?.email;
      if (to) {
        const origin =
          process.env.NEXTAUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000";
        const accountUrl = new URL("/account", origin).toString();
        const component = KycApproved({
          name: user?.name || "there",
          accountUrl,
          level: record?.level || "standard",
        });
        const html = String(await render(component, { pretty: true }));
        const text = `Hi ${user?.name || "there"},\n\nYour KYC has been approved. Your verification level is ${String(record?.level || "standard").toUpperCase()}.\n\nGo to your account: ${accountUrl}\n`;
        await sendEmail({ to, subject: "Your KYC has been approved", html, text });
        emailInfo.sent = true;
      }
    }
  } catch (e) {
    console.error("approveKyc email error", e);
    emailInfo.error = e?.message || "Failed to send email";
  }

  // Revalidate merchants page so the newly promoted user appears there
  revalidatePath("/admin/merchants");

  revalidatePath("/admin/kyc");
  return {
    success: true,
    message: "KYC approved",
    data: {
      id: record.id,
      status: record.status,
      level: record.level,
      rejection_reason: record.rejection_reason,
      email: emailInfo,
    },
    error: {},
  };
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
  if (!reason) {
    return {
      success: false,
      message: "Rejection reason is required",
      error: { reason: "required" },
      data: {},
    };
  }

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

  // Send rejection email (best-effort)
  let emailInfo = { sent: false, error: null };
  try {
    if (record?.user_id) {
      const user = await db.User.findOne({
        where: { id: record.user_id },
        attributes: ["id", "name", "email"],
      });
      const to = user?.email;
      if (to) {
        const origin =
          process.env.NEXTAUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000";
        const accountUrl = new URL("/account", origin).toString();
        const component = KycRejected({
          name: user?.name || "there",
          accountUrl,
          reason: reason || record?.rejection_reason || "",
        });
        const html = String(await render(component, { pretty: true }));
        const text = `Hi ${user?.name || "there"},\n\nWe couldn\'t approve your KYC at this time.${reason ? `\n\nReason: ${reason}` : ""}\n\nReview and resubmit here: ${accountUrl}\n`;
        await sendEmail({ to, subject: "Update on your KYC verification", html, text });
        emailInfo.sent = true;
      }
    }
  } catch (e) {
    console.error("rejectKyc email error", e);
    emailInfo.error = e?.message || "Failed to send email";
  }

  revalidatePath("/admin/kyc");
  return {
    success: true,
    message: "KYC rejected",
    error: {},
    data: {
      id: record.id,
      status: record.status,
      level: record.level,
      rejection_reason: record.rejection_reason,
      email: emailInfo,
    },
  };
}
