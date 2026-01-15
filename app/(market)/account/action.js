"use server";
import z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { headers } from "next/headers";

async function getServerActionHeaders() {
  try {
    if (typeof headers !== "function") return null;
    const h = await headers();
    if (h && typeof h.get === "function") return h;
  } catch {
    return null;
  }
  return null;
}

function getOriginFromHeaders(h) {
  const proto = h?.get("x-forwarded-proto") || "http";
  const host = h?.get("x-forwarded-host") || h?.get("host");
  return host ? `${proto}://${host}` : null;
}

export async function addAccountUpdate(prevState, queryData) {}

export async function deleteOrArchiveProduct(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      success: false,
      message: "You must be logged in",
      errors: { credentials: ["Not authenticated"] },
    };
  }

  const productIdRaw = formData?.get("productId");
  const productId = productIdRaw == null ? "" : String(productIdRaw).trim();
  if (!productId) {
    return {
      success: false,
      message: "Product ID is required",
      errors: { productId: ["Product ID is required"] },
    };
  }

  const hdrs = await getServerActionHeaders();
  const origin =
    getOriginFromHeaders(hdrs) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/item/${encodeURIComponent(productId)}`,
    origin
  ).toString();

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  let response;
  let result;
  try {
    response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      credentials: "include",
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      result = {
        status: response.ok ? "success" : "error",
        message: text || undefined,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to connect to server. Please check your connection and try again.",
      errors: { network: ["Network error occurred"] },
    };
  }
  if (!response.ok || result?.status !== "success") {
    return {
      success: false,
      message: result?.message || "Failed to update product",
      errors: result?.errors || {},
    };
  }

  revalidatePath("/account");

  return {
    success: true,
    message: result?.message || "Product updated",
    action: result?.action,
    errors: {},
  };
}

export async function upsertBank(prevState, formData) {

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return {
        success: false,
        message: "You must be logged in to save bank details",
        errors: { credentials: ["Not authenticated"] },
        data: {}
      };
    }

    const stringify = (v) => (v == null ? undefined : String(v));
    const boolify = (v) => (v === "true" || v === true ? true : false);

    const payload = {
      payout_type: stringify(formData.get("payout_type")) || "bank",
      currency: stringify(formData.get("currency")),
      country_code: stringify(formData.get("country_code")) || undefined,
      bank_code: stringify(formData.get("bank_code")) || undefined,
      bank_name: stringify(formData.get("bank_name")) || undefined,
      bank_id: stringify(formData.get("bank_id")) || undefined,
      account_name: stringify(formData.get("account_name")) || undefined,
      account_number: stringify(formData.get("account_number")) || undefined,
      msisdn: stringify(formData.get("msisdn")) || undefined,
      verified: boolify(formData.get("verified")),
      userId: session.user.id
    };

    const hdrs = await getServerActionHeaders();
    const origin =
      getOriginFromHeaders(hdrs) ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const url = new URL(`/api/marketplace/account/bank`, origin).toString();

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    let response;
    let result;
    try {
      response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = {
          status: response.ok ? "success" : "error",
          message: text || undefined,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Failed to connect to server. Please check your connection and try again.",
        errors: { network: ["Network error occurred"] },
        data: {}
      };
    }
    if (!response.ok || result?.status !== "success") {
      return {
        success: false,
        message: result?.message || "Failed to save bank details",
        errors: result?.errors || {},
        data: {}
      };
    }

    // Revalidate account page cache
    revalidatePath("/account");

    return {
      success: true,
      message: "Bank details saved",
      data: { id: result?.id },
      errors: {},
    };
  
}

export async function upsertKyc(prevState, formData) {

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return {
        success: false,
        message: "You must be logged in to submit KYC",
        errors: { credentials: ["Not authenticated"] },
        data: {}
      };
    }

    const MAX_BYTES = 2 * 1024 * 1024; // 2MB

    const stringify = (v) => (v == null ? undefined : String(v));
    const num = (v) => {
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    // Extract file sizes sent via hidden inputs from the form
    const id_front_size = num(formData.get("id_front_size"));
    const id_back_size = num(formData.get("id_back_size"));
    const selfie_size = num(formData.get("selfie_size"));

    // Zod schema for max-size validation
    const sizeSchema = z.object({
      id_front_size: z
        .number({ invalid_type_error: "Invalid size" })
        .max(MAX_BYTES, { message: "ID front image must be 2MB or less" })
        .optional(),
      id_back_size: z
        .number({ invalid_type_error: "Invalid size" })
        .max(MAX_BYTES, { message: "ID back image must be 2MB or less" })
        .optional(),
      selfie_size: z
        .number({ invalid_type_error: "Invalid size" })
        .max(MAX_BYTES, { message: "Selfie must be 2MB or less" })
        .optional(),
    });

    const sizeParse = sizeSchema.safeParse({
      id_front_size,
      id_back_size,
      selfie_size,
    });

    if (!sizeParse.success) {
      const zodErrors = sizeParse.error.flatten().fieldErrors;
      return {
        success: false,
        message:
          Object.values(zodErrors).flat().join("\n") || "Validation failed",
        errors: zodErrors,
      };
    }

    // Extract fields from FormData
    const payload = {
      status: stringify(formData.get("status")) || "pending",
      level: stringify(formData.get("level")) || "standard",
      first_name: stringify(formData.get("first_name")),
      last_name: stringify(formData.get("last_name")),
      middle_name: stringify(formData.get("middle_name")),
      phone_number: stringify(formData.get("phone_number")),
      dob: stringify(formData.get("dob")) || undefined,
      nationality: stringify(formData.get("nationality")),
      address_line1: stringify(formData.get("address_line1")),
      address_line2: stringify(formData.get("address_line2")),
      city: stringify(formData.get("city")),
      state: stringify(formData.get("state")),
      postal_code: stringify(formData.get("postal_code")),
      country: stringify(formData.get("country")),
      id_type: stringify(formData.get("id_type")),
      id_number: stringify(formData.get("id_number")),
      id_country: stringify(formData.get("id_country")),
      id_expiry: stringify(formData.get("id_expiry")) || undefined,
      id_front_url: stringify(formData.get("id_front_url")) || undefined,
      id_back_url: stringify(formData.get("id_back_url")) || undefined,
      selfie_url: stringify(formData.get("selfie_url")) || undefined,
      provider: stringify(formData.get("provider")) || undefined,
      userId: session.user.id
    };

    const hdrs = await getServerActionHeaders();
    const origin =
      getOriginFromHeaders(hdrs) ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const url = new URL(`/api/marketplace/account/kyc`, origin).toString();

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    let response;
    let result;
    try {
      response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = {
          status: response.ok ? "success" : "error",
          message: text || undefined,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Failed to connect to server. Please check your connection and try again.",
        errors: { network: ["Network error occurred"] },
        data: {}
      };
    }
    if (!response.ok || result?.status !== "success") {
      return {
        success: false,
        message: result?.message || "Failed to submit KYC",
        errors: result?.errors || {},
        data: {}
      };
    }

    // Revalidate account page cache
    revalidatePath("/account");

    return {
      success: true,
      message: result?.message || "KYC submitted",
      data: { kycId: result?.kycId },
      errors: {},
    };
}
