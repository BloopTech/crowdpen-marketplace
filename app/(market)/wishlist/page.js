"use server";

import React from "react";
import WishlistContent from "./content";
import { WishlistContextProvider } from "./context";

export default async function WishlistPage() {
  return (
    <>
      <WishlistContextProvider>
        <WishlistContent />
      </WishlistContextProvider>
    </>
  );
}
