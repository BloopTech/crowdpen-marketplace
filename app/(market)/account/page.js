"use server";

import React from "react";
import AccountContentPage from "./content";
import { AccountContextProvider } from "./context";

export default async function AccountPage() {

  return (
    <>
      <AccountContextProvider>
        <AccountContentPage />
      </AccountContextProvider>
    </>
  );
}
