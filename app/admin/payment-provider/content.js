"use client";

import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Loader2, Settings } from "lucide-react";
import { useAdminPaymentProvider } from "./context";

export default function AdminPaymentProviderContent() {
  const { providerQuery, activeProvider, updateMutation } = useAdminPaymentProvider();

  const checked = activeProvider === "paystack";
  const loading = providerQuery?.isFetching || providerQuery?.isLoading;
  const saving = updateMutation?.isPending;

  const label = useMemo(() => {
    return checked ? "Paystack" : "StartButton";
  }, [checked]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Payment Provider
        </h1>
        <p className="text-muted-foreground">
          Toggle the active payment provider used at checkout.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Active provider</CardTitle>
          <CardDescription>
            When changed, new checkouts will use the selected provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {(loading || saving) && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <span className="font-medium">{label}</span>
            </div>
            <Switch
              checked={checked}
              disabled={loading || saving}
              onCheckedChange={(next) => {
                const provider = next ? "paystack" : "startbutton";
                updateMutation.mutate(provider);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
