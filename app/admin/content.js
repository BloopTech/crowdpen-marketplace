"use client";
import React from "react";
import { useAdmin } from "./context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import millify from "millify";

export default function AdminContent() {
  const { dashboardQuery } = useAdmin();
  const data = dashboardQuery?.data?.data || {};
  const loading = dashboardQuery?.isFetching || dashboardQuery?.isLoading;

  const items = [
    {
      label: "Total Users",
      value: millify(data?.totalUsers, { precision: 2 }),
    },
    {
      label: "Total Merchants",
      value: millify(data?.totalMerchants, { precision: 2 }),
    },
    {
      label: "Pending KYC",
      value: millify(data?.pendingKyc, { precision: 2 }),
    },
    {
      label: "Transactions",
      value: millify(data?.transactions, { precision: 2 }),
    },
    {
      label: "Total Payout Amount",
      value: millify(data?.totalPayoutAmount, { precision: 2 }),
    },
    {
      label: "Total Buyer Paid",
      value: millify(data?.totalSales, { precision: 2 }),
    },
  ];

  return (
    <div className="px-4" data-testid="admin-dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-dashboard-grid">
        {items.map((it) => {
          const cardSlug = it.label.toLowerCase().replace(/\s+/g, "-");
          return (
            <Card key={it.label} data-testid={`admin-dashboard-card-${cardSlug}`}>
              <CardHeader data-testid={`admin-dashboard-card-${cardSlug}-header`}>
                <CardTitle
                  className="text-base"
                  data-testid={`admin-dashboard-card-${cardSlug}-label`}
                >
                  {it.label}
                </CardTitle>
              </CardHeader>
              <CardContent data-testid={`admin-dashboard-card-${cardSlug}-content`}>
                <div
                  className="text-3xl font-semibold"
                  data-testid={`admin-dashboard-card-${cardSlug}-value`}
                >
                  {loading ? "…" : (it.value ?? 0)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
