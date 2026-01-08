"use server";

import React from "react";
import { AdminTicketsProvider } from "./context";
import AdminTicketsContent from "./content";

export default async function AdminTicketsPage() {
  return (
    <AdminTicketsProvider>
      <AdminTicketsContent />
    </AdminTicketsProvider>
  );
}
