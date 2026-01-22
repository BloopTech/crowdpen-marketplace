"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Download, Star, Sparkles, Crown } from "lucide-react";
import { StatusPill } from "./status-pill";
import { useViewerCurrency } from "../hooks/use-viewer-currency";
import { htmlToText } from "../lib/sanitizeHtml";
import { useHome } from "../context";
import { useSession } from "next-auth/react";

export default function GridCard({ resource }) {
  const { openLoginDialog } = useHome();
  const { data: session } = useSession();
  const isOutOfStock =
    resource?.inStock === false ||
    (resource?.stock !== null &&
      typeof resource?.stock !== "undefined" &&
      Number(resource?.stock) <= 0);

  const baseCurrency = (resource?.currency || "USD").toString().toUpperCase();
  const { viewerCurrency, viewerFxRate } = useViewerCurrency(baseCurrency);
  const displayCurrency = (viewerCurrency || baseCurrency)
    .toString()
    .toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const fmt = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0) * displayRate);
  return (
    <Card
      className="h-full flex flex-col hover:shadow-md transition-shadow"
      data-testid={`grid-card-${resource.id}`}
      data-product-id={resource.id}
    >
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={resource.image || "/placeholder.svg"}
          alt={resource.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
        <div className="absolute top-2 left-2 flex flex-col gap-2">
          {resource.featured && (
            <StatusPill
              icon={Sparkles}
              label="Featured"
              className="bg-orange-500/90 backdrop-blur"
            />
          )}
          {resource.isBestseller && (
            <StatusPill
              icon={Crown}
              label="Bestseller"
              className="bg-amber-500/90 backdrop-blur"
            />
          )}
        </div>
      </div>

      <CardContent className="flex-1 p-4">
        <Link
          href={`/product/${resource.product_id ? resource.product_id : resource.id}`}
          data-testid={`grid-card-link-${resource.id}`}
        >
          <h3 className="font-semibold text-foreground hover:text-tertiary hover:underline cursor-pointer line-clamp-1">
            {resource.title}
          </h3>
        </Link>

        <Link
          href={`/author/${resource.author.toLowerCase().replace(/\s+/g, "-")}`}
          data-testid={`grid-card-author-${resource.id}`}
        >
          <div className="text-xs text-muted-foreground mt-1 mb-2 hover:text-tertiary hover:underline cursor-pointer">
            {resource.author}
          </div>
        </Link>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {htmlToText(resource.description)}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{resource.rating}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{resource.downloads.toLocaleString("en-US")}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {resource.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">{fmt(resource.price)}</div>
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
        <Button
          size="sm"
          disabled={isOutOfStock}
          onClick={() => {
            if (isOutOfStock) return;
            if (!session?.user?.id) {
              openLoginDialog("login");
            }
          }}
          data-testid={`grid-card-cart-${resource.id}`}
        >
          {isOutOfStock ? "Out of Stock" : "Add"}
        </Button>
      </CardFooter>
    </Card>
  );
}
