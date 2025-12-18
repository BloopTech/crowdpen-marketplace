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
import { Download, Calendar, DollarSign } from "lucide-react";
import { useAccount } from "../context";
import { useViewerCurrency } from "../../../hooks/use-viewer-currency";

export default function MyPurchases() {
  const { purchases = [] } = useAccount();

  const { viewerCurrency, viewerFxRate } = useViewerCurrency("USD");
  const displayCurrency = (viewerCurrency || "USD").toString().toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const showConverted = displayCurrency !== "USD" && displayRate !== 1;

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
            My Purchases ({purchases.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{purchase.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    by {purchase.author}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Purchased {purchase.purchaseDate}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <div className="flex flex-col leading-tight">
                        <span>
                          {fmtOriginal(purchase.currency, purchase.price)}
                        </span>
                        {showConverted &&
                        (purchase?.currency || "USD")
                          .toString()
                          .toUpperCase() === "USD" ? (
                          <span className="text-[11px] text-muted-foreground">
                            ≈ {fmtViewerFromUsd(purchase.price)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {["completed", "successful"].includes(
                      (purchase.status || "").toString().toLowerCase()
                    )
                      ? "✓ Complete"
                      : "Processing"}
                  </Badge>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
