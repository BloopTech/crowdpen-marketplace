"use server";
import React from "react";
import { ProductContextProvider } from "./context";
import { notFound } from "next/navigation";
import MarketplaceProduct from "@/app/models/MarketplaceProduct";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import EditProductContent from "./content";

export default async function CreateProductPage({ params }) {
  const { id } = await params;

  if (!id) {
    return notFound();
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    return notFound();
  }

  const findProduct = await MarketplaceProduct.findOne({
    where: {
      id,
      user_id: session?.user?.id,
    },
    attributes: [
      "id",
      "user_id",
      "title",
      "image",
      "images",
      "file",
      "fileType",
      "fileSize",
      "description",
      "what_included",
      "featured",
      "deliveryTime",
      "marketplace_category_id",
      "marketplace_subcategory_id",
      "price",
      "originalPrice",
      "license",
      "stock",
      "product_status",
      "content_length"
    ],
  });

  if (!findProduct) {
    return notFound();
  }

  const product = findProduct.toJSON();

  return (
    <>
      <ProductContextProvider>
        <EditProductContent product={product} />
      </ProductContextProvider>
    </>
  );
}
