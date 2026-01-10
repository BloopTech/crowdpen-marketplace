"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { db } from "../../models/index";
import { withServerActionErrorHandling } from "../../lib/observability/withServerActionErrorHandling";

function isAdminOrSenior(user) {
  return user?.role === "admin" || user?.role === "senior_admin";
}

function isSeniorAdmin(user) {
  return user?.role === "senior_admin";
}

async function getTargetUser(userId) {
  return db.User.findOne({ where: { id: userId } });
}

async function promoteToAdminImpl(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }
  const userId = String(formData.get("userId") || "").trim();
  if (!userId) return { success: false, message: "Missing userId" };

  if (userId === session.user.id) {
    return { success: false, message: "You cannot modify your own role here" };
  }

  const target = await getTargetUser(userId);
  if (!target) return { success: false, message: "User not found" };
  if (target.role === "senior_admin") {
    return { success: false, message: "Cannot modify a senior_admin" };
  }

  if (target.role === "admin") {
    return { success: true, message: "Already an admin" };
  }

  await target.update({ role: "admin" });
  revalidatePath("/admin/roles");
  return { success: true, message: "Promoted to admin" };
}

export const promoteToAdmin = withServerActionErrorHandling(promoteToAdminImpl, {
  route: "/admin/roles/promoteToAdmin",
  method: "ACTION",
  tag: "admin_roles",
  getContext: async () => {
    const session = await getServerSession(authOptions);
    return { userId: session?.user?.id || null };
  },
  onError: ({ error }) => {
    return { success: false, message: error?.message || "Failed" };
  },
});

async function demoteAdminToUserImpl(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminOrSenior(session.user)) {
    return { success: false, message: "Unauthorized" };
  }
  const userId = String(formData.get("userId") || "").trim();
  if (!userId) return { success: false, message: "Missing userId" };

  if (userId === session.user.id) {
    return { success: false, message: "You cannot modify your own role here" };
  }

  const target = await getTargetUser(userId);
  if (!target) return { success: false, message: "User not found" };
  if (target.role === "senior_admin") {
    return { success: false, message: "Admins cannot remove a senior_admin" };
  }

  if (target.role !== "admin") {
    return { success: false, message: "Target is not an admin" };
  }

  await target.update({ role: "user" });
  revalidatePath("/admin/roles");
  return { success: true, message: "Admin removed" };
}

export const demoteAdminToUser = withServerActionErrorHandling(demoteAdminToUserImpl, {
  route: "/admin/roles/demoteAdminToUser",
  method: "ACTION",
  tag: "admin_roles",
  getContext: async () => {
    const session = await getServerSession(authOptions);
    return { userId: session?.user?.id || null };
  },
  onError: ({ error }) => {
    return { success: false, message: error?.message || "Failed" };
  },
});

async function promoteToSeniorAdminImpl(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isSeniorAdmin(session.user)) {
    return { success: false, message: "Only senior_admin can add senior_admin" };
  }
  const userId = String(formData.get("userId") || "").trim();
  if (!userId) return { success: false, message: "Missing userId" };

  if (userId === session.user.id) {
    return { success: false, message: "Use a different flow to modify yourself" };
  }

  const target = await getTargetUser(userId);
  if (!target) return { success: false, message: "User not found" };

  if (target.role === "senior_admin") {
    return { success: true, message: "Already a senior_admin" };
  }

  await target.update({ role: "senior_admin" });
  revalidatePath("/admin/roles");
  return { success: true, message: "Promoted to senior_admin" };
}

export const promoteToSeniorAdmin = withServerActionErrorHandling(
  promoteToSeniorAdminImpl,
  {
    route: "/admin/roles/promoteToSeniorAdmin",
    method: "ACTION",
    tag: "admin_roles",
    getContext: async () => {
      const session = await getServerSession(authOptions);
      return { userId: session?.user?.id || null };
    },
    onError: ({ error }) => {
      return { success: false, message: error?.message || "Failed" };
    },
  }
);

async function demoteSeniorAdminToAdminImpl(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session || !isSeniorAdmin(session.user)) {
    return { success: false, message: "Only senior_admin can remove senior_admin" };
  }
  const userId = String(formData.get("userId") || "").trim();
  if (!userId) return { success: false, message: "Missing userId" };

  if (userId === session.user.id) {
    return { success: false, message: "You cannot remove yourself" };
  }

  const target = await getTargetUser(userId);
  if (!target) return { success: false, message: "User not found" };

  if (target.role !== "senior_admin") {
    return { success: false, message: "Target is not a senior_admin" };
  }

  await target.update({ role: "admin" });
  revalidatePath("/admin/roles");
  return { success: true, message: "Senior admin removed (demoted to admin)" };
}

export const demoteSeniorAdminToAdmin = withServerActionErrorHandling(
  demoteSeniorAdminToAdminImpl,
  {
    route: "/admin/roles/demoteSeniorAdminToAdmin",
    method: "ACTION",
    tag: "admin_roles",
    getContext: async () => {
      const session = await getServerSession(authOptions);
      return { userId: session?.user?.id || null };
    },
    onError: ({ error }) => {
      return { success: false, message: error?.message || "Failed" };
    },
  }
);
