"use server";
import React from "react";
import { ProductContextProvider } from "./context";
import CreateProductContent from "./content";

export default async function CreateProductPage() {
  return (
    <>
      <ProductContextProvider>
        <CreateProductContent />
      </ProductContextProvider>
    </>
  );
}
