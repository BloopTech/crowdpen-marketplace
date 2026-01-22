import React from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { db } from "../../../models/index";
import MerchantBackButton from "./merchantBackButton";
import MerchantTabsNav from "./merchantTabsNav";

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

export default async function AdminMerchantLayout({ children, params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !assertAdmin(session.user)) {
    return (
      <div className="px-4" data-testid="admin-merchant-layout">
        <div
          className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6"
          data-testid="admin-merchant-unauthorized"
        >
          <div className="text-lg font-semibold" data-testid="admin-merchant-unauthorized-title">
            Unauthorized
          </div>
          <div
            className="text-sm text-muted-foreground mt-1"
            data-testid="admin-merchant-unauthorized-description"
          >
            You do not have permission to view this page.
          </div>
        </div>
      </div>
    );
  }

  const merchantId = id;
  const merchant = merchantId
    ? await db.User.findOne({
        where: { id: merchantId },
        attributes: ["id", "name", "email", "createdAt", "merchant"],
      })
    : null;

  return (
    <div className="px-4 space-y-4" data-testid="admin-merchant-layout">
      <div
        className="flex items-start justify-between gap-3 flex-wrap"
        data-testid="admin-merchant-header"
      >
        <div data-testid="admin-merchant-header-details">
          <div className="text-xs text-muted-foreground" data-testid="admin-merchant-breadcrumbs">
            <Link
              href="/admin/merchants"
              className="hover:underline"
              data-testid="admin-merchant-breadcrumbs-link"
            >
              Merchants
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground" data-testid="admin-merchant-breadcrumbs-current">
              {merchant?.name || merchant?.email || merchantId || "Merchant"}
            </span>
          </div>
          <div className="text-2xl font-semibold" data-testid="admin-merchant-title">
            {merchant?.name || merchant?.email || merchantId || "Merchant"}
          </div>
          {merchant?.email ? (
            <div className="text-sm text-muted-foreground" data-testid="admin-merchant-email">
              {merchant.email}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2" data-testid="admin-merchant-header-actions">
          <MerchantBackButton href="/admin/merchants" />
        </div>
      </div>

      <MerchantTabsNav merchantId={merchantId} />

      {merchantId && !merchant ? (
        <div
          className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6"
          data-testid="admin-merchant-missing"
        >
          <div className="text-lg font-semibold" data-testid="admin-merchant-missing-title">
            Merchant not found
          </div>
          <div
            className="text-sm text-muted-foreground mt-1"
            data-testid="admin-merchant-missing-description"
          >
            The merchant id is invalid or no longer exists.
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
