"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";

export const AccountContext = React.createContext();

export function AccountContextProvider({ children }) {
  const accountQuery = useQuery({
    queryKey: ["account", "me"],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/account`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to fetch account");
      }
      return data;
    },
  });

  const value = React.useMemo(
    () => ({
      profile: accountQuery.data?.profile,
      purchases: accountQuery.data?.purchases || [],
      wishlist: accountQuery.data?.wishlist || [],
      accountQuery,
    }),
    [accountQuery]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount() {
  const context = React.useContext(AccountContext);
  if (context === undefined) {
    throw new Error(
      "useAccount must be used within an AccountContextProvider"
    );
  }
  return context;
}