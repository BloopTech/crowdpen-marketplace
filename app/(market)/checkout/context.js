"use client";

import React, { createContext, useContext } from "react";
import { useCheckoutController } from "./useCheckoutController";

const CheckoutContext = createContext(null);

export function CheckoutProvider({ children }) {
  const value = useCheckoutController();
  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within CheckoutProvider");
  return ctx;
}
