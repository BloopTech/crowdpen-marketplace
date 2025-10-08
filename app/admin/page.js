"use client";

import React from "react";
import { useAdmin } from "./context";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export default function AdminPage() {
  const { dashboardQuery } = useAdmin();
  const data = dashboardQuery?.data?.data || {};
  const loading = dashboardQuery?.isFetching || dashboardQuery?.isLoading;

  const items = [
    { label: "Total Users", value: data.totalUsers },
    { label: "Total Merchants", value: data.totalMerchants },
    { label: "Pending KYC", value: data.pendingKyc },
    { label: "Transactions", value: data.transactions },
    { label: "Total Payout Amount", value: data.totalPayoutAmount },
    { label: "Total Sales", value: data.totalSales },
  ];

  return (
    <div className="px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.label}>
            <CardHeader>
              <CardTitle className="text-base">{it.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {loading ? "…" : (it.value ?? 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}