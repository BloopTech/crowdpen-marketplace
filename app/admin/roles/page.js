"use server";

import React from "react";
import { AdminRolesProvider } from "./context";
import AdminRolesContent from "./content";

export default async function AdminRolesPage() {
  return (
    <AdminRolesProvider>
      <AdminRolesContent />
    </AdminRolesProvider>
  );
}
