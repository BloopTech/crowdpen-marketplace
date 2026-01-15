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

function buildCookieHeader() {
  try {
    const all = cookies().getAll();
    return all.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch {
    return "";
  }
}

// Schema for validating add all to cart action
const addAllToCartSchema = z.object({
  productIds: z.array(z.string()).min(1, "At least one product is required")
});

// Schema for validating clear wishlist action
const clearWishlistSchema = z.object({
  confirm: z.boolean().optional()
});

export async function addAllProductsCarts(prevState, queryData) {

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      message: "Authentication required",
      errors: { auth: ["Please log in to add items to cart"] },
      success: false
    };
  }

  // Get product IDs from form data (JSON string)
  const productIdsString = queryData.get('productIds');

  let parsedProductIds;
  try {
    parsedProductIds = JSON.parse(productIdsString);
  } catch {
    return {
      message: "Validation failed",
      errors: { productIds: ["Invalid productIds payload"] },
      success: false,
    };
  }

  // Validate the product IDs
  const validatedFields = addAllToCartSchema.safeParse({
    productIds: parsedProductIds
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
      success: false
    };
  }

  const { productIds } = validatedFields.data;

  // Call the API endpoint to add products to cart
  const hdrs = await getServerActionHeaders();
  const origin =
    getOriginFromHeaders(hdrs) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL('/api/marketplace/products/carts/addProducts', origin).toString();

  const body = {
    userId: session.user.id,
    productIds
  };

  const cookieHeader = hdrs?.get("cookie") || buildCookieHeader();

  let response;
  let result;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(body),
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
  } catch {
    return {
      message: "Failed to connect to server. Please check your connection and try again.",
      errors: { server: ["Network error occurred"] },
      success: false,
    };
  }

  if (!response.ok || result?.status === "error") {
    return {
      message: result?.error || result?.message || "Failed to add items to cart",
      errors: { server: [result?.error || result?.message || "Failed to add items to cart"] },
      success: false
    };
  }

  // Revalidate paths to refresh the UI
  revalidatePath('/wishlist');
  revalidatePath('/cart');

  return {
    message:
      result?.message ||
      (result?.data?.addedCount != null
        ? `Successfully added ${result.data.addedCount} items to cart`
        : "Successfully added items to cart"),
    errors: {},
    success: true,
    data: result?.data
  };

}

export async function clearAllWishlist(prevState, queryData) {

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      message: "Authentication required",
      errors: { auth: ["Please log in to clear wishlist"] },
      success: false
    };
  }

  const validatedFields = clearWishlistSchema.safeParse({
    confirm: queryData.get('confirm') === 'true'
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
      success: false
    };
  }

  const hdrs = await getServerActionHeaders();
  const origin =
    getOriginFromHeaders(hdrs) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL('/api/marketplace/products/wishlist/clear', origin).toString();

  const cookieHeader = hdrs?.get("cookie") || buildCookieHeader();

  let response;
  let result;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ userId: session.user.id }),
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
  } catch {
    return {
      message: "Failed to connect to server. Please check your connection and try again.",
      errors: { server: ["Network error occurred"] },
      success: false,
    };
  }

  if (!response.ok || result?.status === "error") {
    return {
      message: result?.error || result?.message || "Failed to clear wishlist",
      errors: { server: [result?.error || result?.message || "Failed to clear wishlist"] },
      success: false
    };
  }

  revalidatePath('/wishlist');

  return {
    message: result?.message || "Successfully cleared wishlist",
    errors: {},
    success: true,
    data: result?.data
  };

}