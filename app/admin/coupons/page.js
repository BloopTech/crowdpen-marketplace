"use server";

import React from "react";
import AdminCouponsContent from "./content";
import { AdminCouponsProvider } from "./context";

export default async function AdminCouponsPage() {
  return (
    <AdminCouponsProvider>
      <AdminCouponsContent />
    </AdminCouponsProvider>
  );
}
