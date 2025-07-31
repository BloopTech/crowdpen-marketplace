"use server";

import React from "react";
import CategoryContentPage from "./content";
import { CategoryContextProvider } from "./context";

export default async function CategoryPage({ params }) {
  const { slug } = await params;

  return (
    <>
      <CategoryContextProvider slug={slug}>
        <CategoryContentPage />
      </CategoryContextProvider>
    </>
  );
}
