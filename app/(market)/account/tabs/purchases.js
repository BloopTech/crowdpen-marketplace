"use client";
import React, { useMemo } from "react";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Download, Calendar, DollarSign } from "lucide-react";
import NextImage from "next/image";
import { useAccount } from "../context";
import { useViewerCurrency } from "../../../hooks/use-viewer-currency";

export default function MyPurchases() {
  const { purchases = [] } = useAccount();

  const { viewerCurrency, viewerFxRate } = useViewerCurrency("USD");
  const displayCurrency = (viewerCurrency || "USD").toString().toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const showConverted = displayCurrency !== "USD" && displayRate !== 1;

  const orders = useMemo(() => {
    const byOrder = new Map();
    for (const p of purchases) {
      const key = p?.orderId || p?.orderNumber || p?.id;
      if (!byOrder.has(key)) {
        byOrder.set(key, {
          orderId: p?.orderId || null,
          orderNumber: p?.orderNumber || null,
          purchaseDate: p?.purchaseDate || null,
          status: p?.status || null,
          currency: p?.currency || "USD",
          price: p?.price ?? null,
          subtotal: p?.subtotal ?? null,
          items: [],
        });
      }
      const entry = byOrder.get(key);
      entry.items.push(p);
      if (entry.purchaseDate == null && p?.purchaseDate != null)
        entry.purchaseDate = p.purchaseDate;
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
            <Download className="h-5 w-5" />
            My Purchases ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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

              return (
                <div
                  key={key}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <div className="flex items-start justify-between p-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {order.orderNumber
                          ? `Order ${order.orderNumber}`
                          : "Order"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {order.items.length} item
                        {order.items.length === 1 ? "" : "s"}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Purchased {order.purchaseDate || "-"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <div className="flex flex-col leading-tight">
                            <span>{fmtOriginal(orderCurrency, usdAmount)}</span>
                            {showConverted && orderCurrency === "USD" ? (
                              <span className="text-[11px] text-muted-foreground">
                                ≈ {fmtViewerFromUsd(usdAmount)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {(() => {
                          const s = (order?.status || "").toString().toLowerCase();
                          const stage = (order?.paymentStage || "")
                            .toString()
                            .toLowerCase();
                          if (["completed", "successful"].includes(s)) return "✓ Complete";
                          if (stage === "verified" || s === "verified") {
                            return "Pending settlement";
                          }
                          return "Processing";
                        })()}
                      </Badge>
                    </div>
                  </div>

                  <div className="border-t border-border">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4"
                      >
                        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <NextImage
                            src={item.image || "/placeholder.svg"}
                            alt={item.title || "Product"}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{item.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            by {item.author}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!item?.canDownload}
                          onClick={() => {
                            if (!item?.id) return;
                            window.open(
                              `/api/marketplace/download/${item.id}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
