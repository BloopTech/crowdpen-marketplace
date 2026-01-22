"use client";

import React from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import KYCTabs from "./tabs";
import { useAdminKyc } from "./context";

export default function AdminKycContent() {
  const {
    tab,
    setTab,
    currentParams,
    setCurrentParams,
    pending,
    approved,
    rejected,
    pendingPage,
    pendingTotalPages,
    approvedPage,
    approvedTotalPages,
    rejectedPage,
    rejectedTotalPages,
    kycPendingQueryRefetch,
    kycApprovedQueryRefetch,
    kycRejectedQueryRefetch,
    loading,
    reviewers,
    setKycPendingParams,
    setKycApprovedParams,
    setKycRejectedParams,
    setQs,
    setReviewId,
    reviewId,
    rejectFormAction,
    rejectIsPending,
    approveFormAction,
    approveIsPending,
    reopenFormAction,
    reopenIsPending,
    approveState,
    rejectState,
    reopenState,
  } = useAdminKyc();

  const handleRefresh = () => {
    if (tab === "pending") kycPendingQueryRefetch();
    else if (tab === "approved") kycApprovedQueryRefetch();
    else kycRejectedQueryRefetch();
  };

  return (
    <div className="px-4 space-y-6" data-testid="admin-kyc-page">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>KYC</CardTitle>
            <Button
              onClick={handleRefresh}
              disabled={loading}
              data-testid="admin-kyc-refresh"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1">Level</label>
              <select
                value={currentParams.level || ""}
                onChange={(e) =>
                  setCurrentParams((p) => ({
                    ...p,
                    page: 1,
                    level: e.target.value,
                  }))
                }
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-kyc-filter-level"
              >
                <option value="">All</option>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="enhanced">Enhanced</option>
              </select>
            </div>
            {tab !== "pending" && (
              <div>
                <label className="block text-xs mb-1">Reviewer</label>
                <select
                  value={currentParams.reviewer || ""}
                  onChange={(e) =>
                    setCurrentParams((p) => ({
                      ...p,
                      page: 1,
                      reviewer: e.target.value,
                    }))
                  }
                  className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="admin-kyc-filter-reviewer"
                >
                  <option value="">All</option>
                  {reviewers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={currentParams.pageSize || 20}
                onChange={(e) =>
                  setCurrentParams((p) => ({
                    ...p,
                    page: 1,
                    pageSize: Number(e.target.value),
                  }))
                }
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-kyc-page-size"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              data-testid="admin-kyc-apply"
            >
              Apply
            </Button>
          </div>
          <KYCTabs
            tab={tab}
            setTab={setTab}
            setQs={setQs}
            pending={pending}
            setKycPendingParams={setKycPendingParams}
            rejected={rejected}
            rejectedPage={rejectedPage}
            rejectedTotalPages={rejectedTotalPages}
            approved={approved}
            approvedPage={approvedPage}
            approvedTotalPages={approvedTotalPages}
            pendingPage={pendingPage}
            pendingTotalPages={pendingTotalPages}
            setKycRejectedParams={setKycRejectedParams}
            setKycApprovedParams={setKycApprovedParams}
            rejectFormAction={rejectFormAction}
            rejectIsPending={rejectIsPending}
            approveFormAction={approveFormAction}
            approveIsPending={approveIsPending}
            reopenFormAction={reopenFormAction}
            reopenIsPending={reopenIsPending}
            setReviewId={setReviewId}
            reviewId={reviewId}
            approveState={approveState}
            rejectState={rejectState}
            reopenState={reopenState}
            kycPendingQueryRefetch={kycPendingQueryRefetch}
            kycApprovedQueryRefetch={kycApprovedQueryRefetch}
            kycRejectedQueryRefetch={kycRejectedQueryRefetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}
