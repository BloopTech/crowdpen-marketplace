"use server";

import React from "react";
import { AdminErrorsProvider } from "./context";
import AdminErrorsContent from "./content";

export default async function AdminErrorsPage() {
  return (
    <AdminErrorsProvider>
      <AdminErrorsContent />
    </AdminErrorsProvider>
  );
}
