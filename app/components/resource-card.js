"use client";

import Image from "next/image";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Download, Star, Sparkles } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "./status-pill";
import { useViewerCurrency } from "../hooks/use-viewer-currency";

export default function ResourceCard({ resource }) {
  const isOutOfStock =
    resource?.inStock === false ||
    (resource?.stock !== null &&
      typeof resource?.stock !== "undefined" &&
      Number(resource?.stock) <= 0);

  const baseCurrency = (resource?.currency || "USD").toString().toUpperCase();
  const { viewerCurrency, viewerFxRate } = useViewerCurrency(baseCurrency);
  const displayCurrency = (viewerCurrency || baseCurrency).toString().toUpperCase();
  const displayRate = Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const fmt = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0) * displayRate);
  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={resource.image || "/placeholder.svg"}
          alt={resource.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
        {resource.featured && (
          <div className="absolute top-2 left-2">
            <StatusPill
              icon={Sparkles}
              label="Featured"
              className="bg-orange-500/90 backdrop-blur"
            />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-black/70 text-white">
            {resource.category}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4">
        <Link href={`/product/${resource.id}`}>
          <h3 className="font-semibold text-lg mb-2 line-clamp-1 hover:text-tertiary cursor-pointer">
            {resource.title}
          </h3>
        </Link>
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
          {resource.description}
        </p>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <Link
            href={`/author/${resource.author.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <span className="text-foreground hover:text-tertiary cursor-pointer">
              by {resource.author}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{resource.rating}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="h-3 w-3" />
          <span>{resource.downloads.toLocaleString("en-US")} downloads</span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{fmt(resource.price)}</div>
          <div className="text-xs mt-1">
            {isOutOfStock ? (
              <Badge className="bg-red-800/90 text-white text-xs">
                Out of stock
              </Badge>
            ) : typeof resource?.stock !== "undefined" &&
              resource?.stock !== null ? (
              `In stock: ${resource?.stock}`
            ) : null}
          </div>
        </div>
        <Button size="sm" disabled={isOutOfStock}>
          {isOutOfStock ? "Out of Stock" : "Add to Cart"}
        </Button>
      </CardFooter>
    </Card>
  );
}
