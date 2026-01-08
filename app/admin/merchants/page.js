"use server";

import React from "react";
import AdminMerchantsContent from "./content";
import { AdminMerchantsProvider } from "./context";

export default async function AdminMerchantsPage() {
  return (
    <AdminMerchantsProvider>
      <AdminMerchantsContent />
    </AdminMerchantsProvider>
  );
}
