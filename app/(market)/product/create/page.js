"use server";
import React from "react";
import { ProductContextProvider } from "./context";
import CreateProductContent from "./content";

export default async function CreateProductPage({ searchParams }) {
  const { draftId } = await searchParams;
  const draftIdRaw = typeof draftId === "string" ? draftId.slice(0, 100) : null;
  return (
    <>
      <ProductContextProvider>
        <CreateProductContent draftId={draftIdRaw} />
      </ProductContextProvider>
    </>
  );
}
