"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";

export default function MerchantBackButton({ href = "/admin/merchants" }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        try {
          if (typeof window !== "undefined" && window.history?.length > 1) {
            router.back();
            return;
          }
        } catch {}
        router.push(href);
      }}
      data-testid="admin-merchant-back-button"
    >
      Back
    </Button>
  );
}
