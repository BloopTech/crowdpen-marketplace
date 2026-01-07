"use server";
import z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sanitizeHtmlServer } from "../../../lib/sanitizeHtmlServer";
import { db } from "../../../models/index";
import { Op } from "sequelize";
import { validate as isUUID } from "uuid";
import { helpfulActionInitialState } from "./helpfulActionState";

const { MarketplaceProduct } = db;

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

export async function deleteOrArchiveProductItem(prevState, formData) {
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
  const proto = hdrs?.get("x-forwarded-proto") || "http";
  const host = hdrs?.get("x-forwarded-host") || hdrs?.get("host");
  const dynamicOrigin = host ? `${proto}://${host}` : null;
  const origin =
    dynamicOrigin ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/item/${encodeURIComponent(productId)}`,
    origin
  ).toString();

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(hdrs?.get("cookie") ? { cookie: hdrs.get("cookie") } : {}),
    },
    credentials: "include",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.status !== "success") {
    return {
      success: false,
      message: result?.message || "Failed to update product",
      errors: result?.errors || {},
    };
  }

  revalidatePath("/account");
  revalidatePath(`/product/${productId}`);

  return {
    success: true,
    message: result?.message || "Product updated",
    action: result?.action,
    errors: {},
  };
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
  const proto = hdrs?.get("x-forwarded-proto") || "http";
  const host = hdrs?.get("x-forwarded-host") || hdrs?.get("host");
  const dynamicOrigin = host ? `${proto}://${host}` : null;
  const origin = dynamicOrigin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

// New action: create or update a user's review (supports rating-only or full review)
export async function upsertProductReview(prevState, queryData) {
  // Get current user from session
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      success: false,
      message: "You must be logged in to rate or review",
      errors: {
        auth: ["Authentication required"],
      },
    };
  }

  const userId = session.user.id;
  const productId = queryData.get("productId");
  if (!productId) {
    return {
      success: false,
      message: "Product ID is required",
      errors: {
        productId: ["Product ID is required"],
      },
    };
  }

  const idParam = String(productId);
  const orConditions = [{ product_id: idParam }];
  if (isUUID(idParam)) {
    orConditions.unshift({ id: idParam });
  }
  const product = await MarketplaceProduct.findOne({
    where: { [Op.or]: orConditions },
    attributes: ["id", "user_id"],
  });
  if (product && String(product.user_id) === String(userId)) {
    return {
      success: false,
      message: "You can't review your own product",
      errors: {
        general: ["You can't review your own product"],
      },
    };
  }

  const rating = parseInt(queryData.get("rating"));
  const title = queryData.get("title");
  const content = queryData.get("content");

  // Validate rating only (content is optional for rating-only flow)
  if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
    return {
      success: false,
      message: "Please provide a valid rating between 1 and 5",
      errors: {
        rating: ["Rating must be between 1 and 5"],
      },
    };
  }

  const body = {
    rating,
    // Trim title if present
    title: title && String(title).trim().length > 0 ? String(title).trim() : null,
    // Content can be empty string for rating-only
    content: typeof content === "string" ? sanitizeHtmlServer(content) : undefined,
    userId,
  };

  // For server actions, we need to use an absolute URL
  const hdrs = await getServerActionHeaders();
  const proto = hdrs?.get("x-forwarded-proto") || "http";
  const host = hdrs?.get("x-forwarded-host") || hdrs?.get("host");
  const dynamicOrigin = host ? `${proto}://${host}` : null;
  const origin = dynamicOrigin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/item/${productId}/reviews`,
    origin
  ).toString();

  const response = await fetch(url, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(hdrs?.get("cookie") ? { cookie: hdrs.get("cookie") } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorResult = await response.json().catch(() => ({}));
    return {
      success: false,
      message: errorResult.message || "Failed to save review",
      errors: {
        general: [errorResult.message || "Failed to save review"],
      },
    };
  }

  const result = await response.json();

  // Revalidate the product page to update statistics and review state
  revalidatePath(`/product/${productId}`);

  return {
    success: true,
    message: result?.message || "Review saved",
    data: result?.data,
  };
}

export async function markReviewHelpful(prevState = helpfulActionInitialState, formData) {
  const previousOverrides = prevState?.overrides
    ? { ...prevState.overrides }
    : {};
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return {
      ...helpfulActionInitialState,
      overrides: previousOverrides,
      success: false,
      message: "You must be logged in to mark a review as helpful",
      errors: {
        auth: ["Authentication required"],
      },
    };
  }

  const productIdRaw = formData?.get("productId");
  const reviewIdRaw = formData?.get("reviewId");

  const productId = productIdRaw == null ? "" : String(productIdRaw).trim();
  const reviewId = reviewIdRaw == null ? "" : String(reviewIdRaw).trim();

  if (!productId || productId.length > 128) {
    return {
      ...helpfulActionInitialState,
      overrides: previousOverrides,
      success: false,
      message: "Product ID is required",
      errors: {
        productId: ["Product ID is required"],
      },
    };
  }

  if (!reviewId || reviewId.length > 128) {
    return {
      ...helpfulActionInitialState,
      overrides: previousOverrides,
      success: false,
      message: "Review ID is required",
      errors: {
        reviewId: ["Review ID is required"],
      },
    };
  }

  const hdrs = await getServerActionHeaders();
  const proto = hdrs?.get("x-forwarded-proto") || "http";
  const host = hdrs?.get("x-forwarded-host") || hdrs?.get("host");
  const dynamicOrigin = host ? `${proto}://${host}` : null;
  const origin =
    dynamicOrigin ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/item/${productId}/reviews`,
    origin
  ).toString();

  const response = await fetch(url, {
    method: "PATCH",
    body: JSON.stringify({
      reviewId,
    }),
    headers: {
      "Content-Type": "application/json",
      ...(hdrs?.get("cookie") ? { cookie: hdrs.get("cookie") } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorResult = await response.json().catch(() => ({}));
    return {
      ...helpfulActionInitialState,
      overrides: previousOverrides,
      success: false,
      message: errorResult?.message || "Failed to update helpful vote",
      errors: {
        general: [errorResult?.message || "Failed to update helpful vote"],
      },
    };
  }

  const result = await response.json().catch(() => ({}));
  const isHelpfulByMe = result?.data?.isHelpfulByMe === true;
  const nextOverrides = {
    ...previousOverrides,
    ...(result?.data?.reviewId
      ? {
          [result.data.reviewId]: {
            count: result.data.helpful ?? 0,
            marked: isHelpfulByMe,
          },
        }
      : {}),
  };

  revalidatePath(`/product/${productId}`);

  return {
    overrides: nextOverrides,
    success: true,
    message: result?.message || "Thanks for the feedback!",
    data: result?.data
      ? {
          ...result.data,
        }
      : null,
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
  const proto = hdrs?.get("x-forwarded-proto") || "http";
  const host = hdrs?.get("x-forwarded-host") || hdrs?.get("host");
  const dynamicOrigin = host ? `${proto}://${host}` : null;
  const origin = dynamicOrigin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

// Schema for review validation
const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  content: z.string().min(1, "Review content is required"),
});

export async function createProductReview(prevState, queryData) {
  // Get current user from session
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      success: false,
      message: "You must be logged in to write a review",
      errors: {
        auth: ["Authentication required"],
      },
    };
  }

  const userId = session.user.id;
  const productId = queryData.get("productId");
  if (!productId) {
    return {
      success: false,
      message: "Product ID is required",
      errors: {
        productId: ["Product ID is required"],
      },
    };
  }

  const idParam = String(productId);
  const orConditions = [{ product_id: idParam }];
  if (isUUID(idParam)) {
    orConditions.unshift({ id: idParam });
  }
  const product = await MarketplaceProduct.findOne({
    where: { [Op.or]: orConditions },
    attributes: ["id", "user_id"],
  });
  if (product && String(product.user_id) === String(userId)) {
    return {
      success: false,
      message: "You can't review your own product",
      errors: {
        general: ["You can't review your own product"],
      },
    };
  }

  const rating = parseInt(queryData.get("rating"));
  const title = queryData.get("title");
  const content = queryData.get("content");

  // Validate the input
  const validatedFields = reviewSchema.safeParse({
    rating,
    title: title || undefined,
    content,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: "Please check your input and try again",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const body = {
    rating: validatedFields.data.rating,
    title: validatedFields.data.title,
    content: sanitizeHtmlServer(validatedFields.data.content),
    userId
  };

  // For server actions, we need to use an absolute URL
  const hdrs = await getServerActionHeaders();
  const proto = hdrs?.get("x-forwarded-proto") || "http";
  const host = hdrs?.get("x-forwarded-host") || hdrs?.get("host");
  const dynamicOrigin = host ? `${proto}://${host}` : null;
  const origin = dynamicOrigin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/item/${productId}/reviews/create`,
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
      message: errorResult.message || "Failed to create review",
      errors: {
        general: [errorResult.message || "Failed to create review"],
      },
    };
  }

  const result = await response.json();

  // Revalidate the product page to show the new review
  revalidatePath(`/product/${productId}`);

  return {
    success: true,
    message: "Review created successfully!",
    data: result.data,
  };
}
