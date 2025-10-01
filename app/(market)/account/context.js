"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import { useQuery } from "@tanstack/react-query";

export const AccountContext = createContext();

export function AccountContextProvider({ children }) {
  const [payoutType, setPayoutType] = useState("bank");

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

  const bankListQuery = useQuery({
    queryKey: ["bank-list", payoutType],
    enabled: payoutType === "bank" || payoutType === "mobile_money",
    keepPreviousData: true,
    queryFn: async () => {
      const qs = new URLSearchParams({ type: payoutType || "" });
      const res = await fetch(
        `/api/marketplace/startbutton/bank-list?${qs.toString()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || data?.status !== "success") {
        throw new Error(data?.message || "Failed to fetch bank list");
      }
      return data;
    },
  });

  const value = useMemo(
    () => ({
      profile: accountQuery.data?.profile,
      purchases: accountQuery.data?.purchases || [],
      kyc: accountQuery.data?.kyc || null,
      bank: accountQuery.data?.bank || null,
      accountQuery,
    }),
    [accountQuery]
  );

  const banks = useMemo(() => {
    const list = bankListQuery?.data?.banks;
    if (!Array.isArray(list)) return [];
    const byCode = new Map();
    for (const item of list) {
      const code = String(item?.code ?? "");
      if (!code) continue;
      if (!byCode.has(code)) byCode.set(code, item);
    }
    return Array.from(byCode.values());
  }, [bankListQuery?.data?.banks]);

  const loadingBanks = bankListQuery?.isFetching;

  return (
    <AccountContext.Provider
      value={{
        ...value,
        bankListQuery,
        banks,
        loadingBanks,
        payoutType,
        setPayoutType,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccount must be used within an AccountContextProvider");
  }
  return context;
}
