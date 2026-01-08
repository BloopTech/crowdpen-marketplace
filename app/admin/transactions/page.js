"use server";

import React from "react";
import { AdminTransactionsProvider } from "./context";
import AdminTransactionsContent from "./content";

export default async function AdminTransactionsPage() {
  return (
    <AdminTransactionsProvider>
      <AdminTransactionsContent />
    </AdminTransactionsProvider>
  );
}
