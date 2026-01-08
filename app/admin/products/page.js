"use server";

import React from "react";
import { AdminProductsProvider } from "./list-context";
import { AdminProductDialogProvider } from "./details-context";
import AdminProductsContent from "./content";
import ProductDetailsDialog from "./ProductDetailsDialog";

export default async function AdminProductsPage() {
  return (
    <AdminProductsProvider>
      <AdminProductDialogProvider>
        <AdminProductsContent />
        <ProductDetailsDialog />
      </AdminProductDialogProvider>
    </AdminProductsProvider>
  );
}

