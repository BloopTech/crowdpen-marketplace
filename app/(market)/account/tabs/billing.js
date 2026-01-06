"use client";
import React from "react";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Separator } from "../../../components/ui/separator";
import { useAccount } from "../context";
import { CreditCard } from "lucide-react";
import { useViewerCurrency } from "../../../hooks/use-viewer-currency";

export default function MyBillings() {
  const { purchases = [] } = useAccount();

  const { viewerCurrency, viewerFxRate } = useViewerCurrency("USD");
  const displayCurrency = (viewerCurrency || "USD").toString().toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const showConverted = displayCurrency !== "USD" && displayRate !== 1;

  const orders = React.useMemo(() => {
    const byOrder = new Map();
    for (const p of purchases) {
      const key = p?.orderId || p?.orderNumber || p?.id;
      if (!byOrder.has(key)) {
        byOrder.set(key, {
          orderId: p?.orderId || null,
          orderNumber: p?.orderNumber || null,
          status: p?.status || null,
          currency: p?.currency || "USD",
          price: p?.price ?? null,
          subtotal: p?.subtotal ?? null,
          items: [],
        });
      }
      const entry = byOrder.get(key);
      entry.items.push(p);
      if (entry.status == null && p?.status != null) entry.status = p.status;
      if (entry.currency == null && p?.currency != null) entry.currency = p.currency;
      if (entry.price == null && p?.price != null) entry.price = p.price;
      if (entry.subtotal == null && p?.subtotal != null) entry.subtotal = p.subtotal;
    }
    return Array.from(byOrder.values());
  }, [purchases]);

  const fmtOriginal = (currency, v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toString().toUpperCase(),
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  const fmtViewerFromUsd = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0) * displayRate);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing & Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" />
                <div>
                  <div className="font-medium">•••• •••• •••• 4242</div>
                  <div className="text-sm text-muted-foreground">
                    Expires 12/25
                  </div>
                </div>
              </div>
              <Badge>Default</Badge>
            </div>
          </div>
          <Button variant="outline">Add Payment Method</Button>

          <Separator /> */}

          <div>
            <h3 className="font-semibold mb-3">Recent Transactions</h3>
            <div className="space-y-2">
              {orders.map((order) => {
                const usdAmount =
                  order?.price != null
                    ? order.price
                    : order?.subtotal != null
                      ? order.subtotal
                      : 0;
                const key =
                  order?.orderId || order?.orderNumber || order?.items?.[0]?.id;
                const orderCurrency = (order?.currency || "USD")
                  .toString()
                  .toUpperCase();

                const firstTitle = order?.items?.[0]?.title || "Order";
                const title =
                  order.items.length <= 1
                    ? firstTitle
                    : `${firstTitle} +${order.items.length - 1} more`;

                return (
                  <div key={key} className="flex justify-between text-sm">
                    <span>{title}</span>
                    <div className="flex flex-col items-end leading-tight">
                      <span>{fmtOriginal(orderCurrency, usdAmount)}</span>
                      {showConverted && orderCurrency === "USD" ? (
                        <span className="text-[11px] text-muted-foreground">
                          ≈ {fmtViewerFromUsd(usdAmount)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
