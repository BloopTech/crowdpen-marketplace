"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";

function isAdminOrSenior(user) {
  return user?.role === "admin" || user?.role === "senior_admin";
}

export async function createPayout(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }

  const recipient_id = String(formData.get("recipient_id") || "").trim();
  const amountStr = String(formData.get("amount") || "").trim();
  const currency = String(formData.get("currency") || "").trim() || "USD";
  const transaction_reference = String(formData.get("transaction_reference") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const amount = Number(amountStr);
  if (!recipient_id || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: "Invalid inputs" };
  }

  const user = await db.User.findOne({ where: { id: recipient_id } });
  if (!user) return { success: false, message: "Recipient not found" };

  const tx = await db.MarketplaceAdminTransactions.create({
    recipient_id,
    trans_type: "payout",
    status: "completed",
    amount: Math.round(amount),
    currency,
    transaction_reference,
    gateway_reference: note,
  });

  revalidatePath("/admin/payouts");
  revalidatePath("/admin/transactions");
  return { success: true, message: "Payout recorded", data: { id: tx.id } };
}
