"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useAdmin } from "../context";

const AdminRolesContext = createContext(undefined);

export function AdminRolesProvider({ children }) {
  const { data: session } = useSession();
  const { usersQuery } = useAdmin();

  const users = useMemo(() => usersQuery?.data?.data || [], [usersQuery?.data?.data]);
  const loading = usersQuery?.isFetching || usersQuery?.isLoading;
  const error = usersQuery?.error?.message;
  const sessionUserId = session?.user?.id;
  const isSenior = session?.user?.role === "senior_admin";

  const value = useMemo(
    () => ({
      session,
      sessionUserId,
      isSenior,
      users,
      loading,
      error,
      refetch: usersQuery?.refetch,
    }),
    [session, sessionUserId, isSenior, users, loading, error, usersQuery?.refetch]
  );

  return (
    <AdminRolesContext.Provider value={value}>
      {children}
    </AdminRolesContext.Provider>
  );
}

export function useAdminRoles() {
  const ctx = useContext(AdminRolesContext);
  if (!ctx) {
    throw new Error("useAdminRoles must be used within an AdminRolesProvider");
  }
  return ctx;
}
