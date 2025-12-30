"use server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
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

export async function addProductWishlist(prevState, queryData) {
  // Get current user from session
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      success: false,
      message: "You must be logged in to create a product",
      errors: {
        credentials: !!session,
      },
    };
  }

  const userId = session.user.id;

  const productId = queryData.get("productId");

  const body = {
    user_id: userId,
  };

  // For server actions, we need to use an absolute URL
  const hdrs = await getServerActionHeaders();
  const origin =
    getOriginFromHeaders(hdrs) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/item/${productId}/wishlist`,
    origin
  ).toString();

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(hdrs?.get("cookie") ? { cookie: hdrs.get("cookie") } : {}),
    },
    credentials: "include",
  });
  console.log("response..........................", response);
  if (!response.ok) {
    const errorResult = await response.json();
    return {
      success: false,
      message: errorResult.message || "Failed to update wishlist",
      errors: {
        productId: [errorResult.message || "Failed to update wishlist"],
      },
    };
  }

  const result = await response.json();

  if (result.status === "error") {
    return {
      success: false,
      message: result.message,
      errors: {
        productId: [result.message],
      },
    };
  }

  return {
    success: true,
    message: result?.message || "Wishlist updated successfully",
    errors: {},
    inWishlist: result?.inWishlist,
  };
}

export async function addProductToCart(prevState, queryData) {
  // Get current user from session
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      success: false,
      message: "You must be logged in to add items to cart",
      errors: {
        credentials: !!session,
      },
    };
  }

  const userId = session.user.id;
  const productId = queryData.get("productId");
  const quantity = parseInt(queryData.get("quantity")) || 1;

  if (!productId) {
    return {
      success: false,
      message: "Product ID is required",
      errors: {
        productId: ["Product ID is required"],
      },
    };
  }

  const body = {
    user_id: userId,
    product_id: productId,
    quantity: quantity,
  };

  // For server actions, we need to use an absolute URL
  const hdrs = await getServerActionHeaders();
  const origin =
    getOriginFromHeaders(hdrs) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/item/${productId}/carts`,
    origin
  ).toString();

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(hdrs?.get("cookie") ? { cookie: hdrs.get("cookie") } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorResult = await response.json();
    return {
      success: false,
      message: errorResult.message || "Failed to add item to cart",
      errors: {
        productId: [errorResult.message || "Failed to add item to cart"],
      },
    };
  }

  const result = await response.json();

  if (result.status === "error") {
    return {
      success: false,
      message: result.message,
      errors: {
        productId: [result.message],
      },
    };
  }

  return {
    success: true,
    message: result?.message || "Item added to cart successfully",
    errors: {},
    cartItem: result?.cartItem,
    action: result?.action,
  };
}
