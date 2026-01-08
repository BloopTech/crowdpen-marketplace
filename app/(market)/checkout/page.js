"use client";

import React from "react";
import { CartContextProvider } from "../cart/context";
import CheckoutContent from "./content";
import { CheckoutProvider } from "./context";

export default function CheckoutPage() {
  return (
    <CartContextProvider ignoreUrlFilters pageSize={50} autoLoadAll>
      <CheckoutProvider>
        <CheckoutContent />
      </CheckoutProvider>
    </CartContextProvider>
  );
}
