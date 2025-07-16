"use server";
import z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addProductWishlist(prevState, queryData) {
  // Get current user from session
  // const session = await getServerSession(authOptions);
  // if (!session || !session.user) {
  //   return {
  //     success: false,
  //     message: "You must be logged in to create a product",
  //   };
  // }

  //const userId = session.user.id;

  const productId = queryData.get("productId");

  const body = {
    user_id: "2012239a-0286-4026-8ed5-24cb41997b92",
  };

  // For server actions, we need to use an absolute URL
  const origin =
    process.env.NEXTAUTH_URL;
  const url = new URL(
    `/app/api/marketplace/products/item/${productId}/wishlist`,
    origin
  ).toString();

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
  const result = await response.json();

  if (result.status === "error") {
    return {
      success: false,
      message: result.message,
      errors: {
        credentials: result?.message,
      },
    };
  }

  console.log("result......................", result);
  return {
    message: result?.message,
    errors: {},
    values: {},
    inWishlist: result?.inWishlist,
  };
}
