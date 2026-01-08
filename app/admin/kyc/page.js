"use server";

import React from "react";
import { AdminKycProvider } from "./context";
import AdminKycContent from "./content";

export default async function AdminKycPage() {
  return (
    <AdminKycProvider>
      <AdminKycContent />
    </AdminKycProvider>
  );
}
