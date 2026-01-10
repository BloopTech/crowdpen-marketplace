"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { getRequestIdFromHeaders, reportError } from "../../lib/observability/reportError";

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

// Validation schemas
const updateCartItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().min(1).max(100),
});

const removeCartItemSchema = z.object({
  itemId: z.string().uuid(),
});

const clearCartSchema = z.object({
  penName: z.string().min(1),
});

// Update cart item quantity
export async function updateCartItemQuantity(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Authentication required",
      errors: { auth: ["Please log in to update your cart"] }
    };
  }

  // Parse and validate form data
  const rawData = {
    itemId: formData.get('itemId'),
    quantity: parseInt(formData.get('quantity'))
  };

  const validationResult = updateCartItemSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      success: false,
      message: "Invalid data provided",
      errors: validationResult.error.flatten().fieldErrors
    };
  }

  const { itemId, quantity } = validationResult.data;

  try {
    // Call the API endpoint to update cart item
    const hdrs = await getServerActionHeaders();
    const origin =
      getOriginFromHeaders(hdrs) ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const url = new URL(`/api/marketplace/products/item/${itemId}/carts/update`, origin).toString();

    const cookieHeader = hdrs?.get("cookie") || buildCookieHeader();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      },
      body: JSON.stringify({
        action: 'update_quantity',
        quantity
      }),
      credentials: "include",
    });

    if (!response.ok) {
      const errorResult = await response.json();
      return {
        success: false,
        message: errorResult.error || "Failed to update cart item",
        errors: { server: [errorResult.error || "Failed to update cart item"] }
      };
    }

    const result = await response.json();

    // Revalidate the cart page
    revalidatePath('/cart');

    return {
      success: true,
      message: result.message || "Cart updated successfully",
      errors: {},
      data: result.data
    };

  } catch (error) {
    const hdrs = await getServerActionHeaders();
    const requestId = getRequestIdFromHeaders(hdrs);
    await reportError(error, {
      tag: "cart_update_quantity",
      route: "server_action:cart#updateCartItemQuantity",
      method: "SERVER_ACTION",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
    });
    return {
      success: false,
      message: "Failed to update cart item",
      errors: { server: ["An unexpected error occurred"] }
    };
  }
}

// Remove cart item
export async function removeCartItem(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Authentication required",
      errors: { auth: ["Please log in to update your cart"] }
    };
  }

  // Parse and validate form data
  const rawData = {
    itemId: formData.get('itemId')
  };

  const validationResult = removeCartItemSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      success: false,
      message: "Invalid data provided",
      errors: validationResult.error.flatten().fieldErrors
    };
  }

  const { itemId } = validationResult.data;

  try {
    // Call the API endpoint to remove cart item
    const hdrs = await getServerActionHeaders();
    const origin =
      getOriginFromHeaders(hdrs) ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const url = new URL(`/api/marketplace/products/item/${itemId}/carts/update`, origin).toString();

    const cookieHeader = hdrs?.get("cookie") || buildCookieHeader();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      },
      body: JSON.stringify({
        action: 'remove_item'
      }),
      credentials: "include",
    });

    if (!response.ok) {
      const errorResult = await response.json();
      return {
        success: false,
        message: errorResult.error || "Failed to remove cart item",
        errors: { server: [errorResult.error || "Failed to remove cart item"] }
      };
    }

    const result = await response.json();

    // Revalidate the cart page
    revalidatePath('/cart');

    return {
      success: true,
      message: result.message || "Item removed from cart",
      errors: {},
      data: result.data
    };

  } catch (error) {
    const hdrs = await getServerActionHeaders();
    const requestId = getRequestIdFromHeaders(hdrs);
    await reportError(error, {
      tag: "cart_remove_item",
      route: "server_action:cart#removeCartItem",
      method: "SERVER_ACTION",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
    });
    return {
      success: false,
      message: "Failed to remove cart item",
      errors: { server: ["An unexpected error occurred"] }
    };
  }
}

// Clear entire cart
export async function clearCart(prevState, formData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Authentication required",
      errors: { auth: ["Please log in to clear your cart"] }
    };
  }

  // Parse and validate form data
  const rawData = {
    penName: formData.get('penName')
  };

  const validationResult = clearCartSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      success: false,
      message: "Invalid data provided",
      errors: validationResult.error.flatten().fieldErrors
    };
  }

  const { penName } = validationResult.data;

  // Verify the user is clearing their own cart
  if (session.user.pen_name !== penName) {
    return {
      success: false,
      message: "Access denied",
      errors: { auth: ["You can only clear your own cart"] }
    };
  }

  try {
    // Call the API endpoint to clear cart
    const hdrs = await getServerActionHeaders();
    const origin =
      getOriginFromHeaders(hdrs) ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const url = new URL('/api/marketplace/products/carts/clear', origin).toString();

    const cookieHeader = hdrs?.get("cookie") || buildCookieHeader();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      },
      body: JSON.stringify({
        penName
      }),
      credentials: "include",
    });

    if (!response.ok) {
      const errorResult = await response.json();
      return {
        success: false,
        message: errorResult.error || "Failed to clear cart",
        errors: { server: [errorResult.error || "Failed to clear cart"] }
      };
    }

    const result = await response.json();

    // Revalidate the cart page
    revalidatePath('/cart');

    return {
      success: true,
      message: result.message || "Cart cleared successfully",
      errors: {},
      data: result.data
    };

  } catch (error) {
    const hdrs = await getServerActionHeaders();
    const requestId = getRequestIdFromHeaders(hdrs);
    await reportError(error, {
      tag: "cart_clear",
      route: "server_action:cart#clearCart",
      method: "SERVER_ACTION",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
    });
    return {
      success: false,
      message: "Failed to clear cart",
      errors: { server: ["An unexpected error occurred"] }
    };
  }
}

// Legacy function for backward compatibility
export function updateUserCart(prevState, queryData) {
  // This function is kept for backward compatibility
  // New implementations should use the specific action functions above
  return {
    success: false,
    message: "Please use specific cart action functions",
    errors: { deprecated: ["This function is deprecated"] }
  };
}