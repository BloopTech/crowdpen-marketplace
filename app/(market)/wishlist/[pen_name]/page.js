"use server";

import React from "react";
import WishlistContent from "../content";
import { WishlistContextProvider } from "../context";

export default async function PublicWishlistPage({ params }) {
  const getParams = await params;
  const penName = getParams?.pen_name;

  return (
    <>
      <WishlistContextProvider penName={penName}>
        <WishlistContent />
      </WishlistContextProvider>
    </>
  );
}
