"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PaginationSmart } from "../../../components/ui/pagination";

export default function MerchantSubpagePagination({
  currentPage,
  totalPages,
  pageParamKey = "page",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onPageChange = useCallback(
    (nextPage) => {
      if (!pathname) return;
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set(pageParamKey, String(nextPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [pageParamKey, pathname, router, searchParams]
  );

  if (!totalPages || totalPages <= 1) return null;

  return (
    <div data-testid="admin-merchant-pagination">
      <PaginationSmart
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={onPageChange}
      />
    </div>
  );
}
