"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../../lib/utils";

export default function MerchantTabsNav({ merchantId }) {
  const pathname = usePathname();

  const tabs = useMemo(() => {
    const base = `/admin/merchants/${merchantId}`;
    return [
      { key: "overview", label: "Overview", href: base },
      { key: "products", label: "Products", href: `${base}/products` },
      { key: "sales", label: "Sales", href: `${base}/sales` },
      { key: "buyers", label: "Buyers", href: `${base}/buyers` },
      { key: "payouts", label: "Payouts", href: `${base}/payouts` },
      { key: "transactions", label: "Transactions", href: `${base}/transactions` },
    ];
  }, [merchantId]);

  const isActive = (href) => {
    if (!pathname) return false;
    if (href === `/admin/merchants/${merchantId}`) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                "px-3 py-2 text-sm rounded-t-md -mb-px border border-transparent text-muted-foreground hover:text-foreground",
                active
                  ? "border-border border-b-background bg-background text-foreground"
                  : "hover:bg-muted"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
