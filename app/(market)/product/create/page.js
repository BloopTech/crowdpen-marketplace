"use server";
import React from "react";
import { ProductContextProvider } from "./context";
import CreateProductContent from "./content";

export default async function CreateProductPage({ searchParams }) {
  const draftIdRaw = searchParams?.draftId;
  const draftId = typeof draftIdRaw === "string" ? draftIdRaw.slice(0, 100) : null;
  return (
    <>
      <ProductContextProvider>
        <CreateProductContent draftId={draftId} />
      </ProductContextProvider>
    </>
  );
}
