"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const AdminProductDialogContext = createContext(null);

export function AdminProductDialogProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(null);

  const openDetails = useCallback((id) => {
    setProductId(id);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, setOpen, productId, setProductId, openDetails, close }),
    [open, productId, openDetails, close]
  );

  return (
    <AdminProductDialogContext.Provider value={value}>
      {children}
    </AdminProductDialogContext.Provider>
  );
}

export function useAdminProductDialog() {
  const ctx = useContext(AdminProductDialogContext);
  if (!ctx) throw new Error("useAdminProductDialog must be used within AdminProductDialogProvider");
  return ctx;
}
