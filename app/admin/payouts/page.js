"use server";

import React from "react";
import { AdminPayoutsProvider } from "./context";
import AdminPayoutsContent from "./content";

export default async function AdminPayoutsPage() {
  return (
    <AdminPayoutsProvider>
      <AdminPayoutsContent />
    </AdminPayoutsProvider>
  );
}
