"use server";

import React from "react";
import AdminPaymentProviderContent from "./content";
import { AdminPaymentProviderProvider } from "./context";

export default async function AdminPaymentProviderPage() {
  return (
    <AdminPaymentProviderProvider>
      <AdminPaymentProviderContent />
    </AdminPaymentProviderProvider>
  );
}
