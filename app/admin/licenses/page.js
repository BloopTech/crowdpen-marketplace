"use server";

import React from "react";
import AdminLicensesContent from "./content";
import { AdminLicensesProvider } from "./context";

export default async function AdminLicensesPage() {
  return (
    <AdminLicensesProvider>
      <AdminLicensesContent />
    </AdminLicensesProvider>
  );
}
