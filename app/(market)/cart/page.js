"use server";

import React from "react";
import CartContent from "./content";
import { CartContextProvider } from "./context";

export default async function CartPage() {
  return (
    <>
      <CartContextProvider>
        <CartContent />
      </CartContextProvider>
    </>
  );
}
