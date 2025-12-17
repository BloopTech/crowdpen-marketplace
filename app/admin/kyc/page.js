"use client";

import React, { useEffect, useState, useActionState } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import KYCTabs from "./tabs";
import { approveKyc, rejectKyc } from "./actions";
import { success } from "zod";
import { toast } from "sonner";

const rejectInitialState = {
  message: "",
  success: [],
};

const approveInitialState = {
  message: "",
  success: [],
};

export default function KycPage() {
  const {
    kycPendingQueryData,
    kycPendingQueryLoading,
    kycPendingQueryRefetch,
    kycApprovedQueryData,
    kycApprovedQueryRefetch,
    kycApprovedQueryLoading,
    kycRejectedQueryData,
    kycRejectedQueryLoading,
    kycRejectedQueryRefetch,
    kycPendingParams,
    kycApprovedParams,
    kycRejectedParams,
    setKycPendingParams,
    setKycApprovedParams,
    setKycRejectedParams,
    usersQuery,
  } = useAdmin();

  const [rejectState, rejectFormAction, rejectIsPending] = useActionState(
    rejectKyc,
    rejectInitialState
  );
  const [approveState, approveFormAction, approveIsPending] = useActionState(
    approveKyc,
    approveInitialState
  );

  const [tab, setTab] = useState("pending");
  const [reviewId, setReviewId] = useState("");
  const [qs, setQs] = useQueryStates(
    {
      kycTab: parseAsString.withDefault("pending"),
      pendingPage: parseAsInteger.withDefault(1),
      pendingPageSize: parseAsInteger.withDefault(20),
      pendingLevel: parseAsString.withDefault(""),
      approvedPage: parseAsInteger.withDefault(1),
      approvedPageSize: parseAsInteger.withDefault(20),
      approvedLevel: parseAsString.withDefault(""),
      approvedReviewer: parseAsString.withDefault(""),
      rejectedPage: parseAsInteger.withDefault(1),
      rejectedPageSize: parseAsInteger.withDefault(20),
      rejectedLevel: parseAsString.withDefault(""),
      rejectedReviewer: parseAsString.withDefault(""),
      kycReviewId: parseAsString.withDefault(""),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    if (
      Object.keys(rejectState?.data || {}).length > 0 &&
      rejectState.message
    ) {
      toast.success(rejectState.message);
      if (rejectState?.data?.email?.error) {
        toast.error(`Email failed: ${rejectState.data.email.error}`);
      }
      kycApprovedQueryRefetch();
      kycPendingQueryRefetch();
      kycRejectedQueryRefetch();
    } else if (
      Object.keys(rejectState?.error || {}).length > 0 &&
      rejectState.message
    ) {
      toast.error(rejectState.message);
    }
  }, [
    kycApprovedQueryRefetch,
    kycPendingQueryRefetch,
    kycRejectedQueryRefetch,
    rejectState,
  ]);

  useEffect(() => {
    if (
      Object.keys(approveState?.data || {}).length > 0 &&
      approveState.message
    ) {
      toast.success(approveState.message);
      if (approveState?.data?.email?.error) {
        toast.error(`Email failed: ${approveState.data.email.error}`);
      }
      kycApprovedQueryRefetch();
      kycPendingQueryRefetch();
    } else if (
      Object.keys(approveState?.error || {}).length > 0 &&
      approveState.message
    ) {
      toast.error(approveState.message);
    }
  }, [kycApprovedQueryRefetch, kycPendingQueryRefetch, approveState]);

  useEffect(() => {
    // Initialize from URL
    setTab(qs.kycTab);
    setReviewId(qs.kycReviewId);
    setKycPendingParams((p) => ({
      ...p,
      page: qs.pendingPage,
      pageSize: qs.pendingPageSize,
      level: qs.pendingLevel,
    }));
    setKycApprovedParams((p) => ({
      ...p,
      page: qs.approvedPage,
      pageSize: qs.approvedPageSize,
      level: qs.approvedLevel,
      reviewer: qs.approvedReviewer,
    }));
    setKycRejectedParams((p) => ({
      ...p,
      page: qs.rejectedPage,
      pageSize: qs.rejectedPageSize,
      level: qs.rejectedLevel,
      reviewer: qs.rejectedReviewer,
    }));
    kycPendingQueryRefetch();
    kycApprovedQueryRefetch();
    kycRejectedQueryRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = kycPendingQueryData?.data || [];
  const approved = kycApprovedQueryData?.data || [];
  const rejected = kycRejectedQueryData?.data || [];

  const pendingPage = kycPendingQueryData?.page || kycPendingParams.page || 1;
  const pendingPageSize =
    kycPendingQueryData?.pageSize || kycPendingParams.pageSize || 20;
  const pendingTotal = kycPendingQueryData?.total || 0;
  const pendingTotalPages = Math.max(
    1,
    Math.ceil(pendingTotal / pendingPageSize)
  );

  const approvedPage =
    kycApprovedQueryData?.page || kycApprovedParams.page || 1;
  const approvedPageSize =
    kycApprovedQueryData?.pageSize || kycApprovedParams.pageSize || 20;
  const approvedTotal = kycApprovedQueryData?.total || 0;
  const approvedTotalPages = Math.max(
    1,
    Math.ceil(approvedTotal / approvedPageSize)
  );

  const rejectedPage =
    kycRejectedQueryData?.page || kycRejectedParams.page || 1;
  const rejectedPageSize =
    kycRejectedQueryData?.pageSize || kycRejectedParams.pageSize || 20;
  const rejectedTotal = kycRejectedQueryData?.total || 0;
  const rejectedTotalPages = Math.max(
    1,
    Math.ceil(rejectedTotal / rejectedPageSize)
  );

  const loading =
    kycPendingQueryLoading ||
    kycApprovedQueryLoading ||
    kycRejectedQueryLoading;

  const reviewers = usersQuery?.data?.data || [];

  const currentParams =
    tab === "pending"
      ? kycPendingParams
      : tab === "approved"
        ? kycApprovedParams
        : kycRejectedParams;
  const setCurrentParams =
    tab === "pending"
      ? setKycPendingParams
      : tab === "approved"
        ? setKycApprovedParams
        : setKycRejectedParams;

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>KYC</CardTitle>
            <Button
              onClick={() => {
                if (tab === "pending") kycPendingQueryRefetch();
                else if (tab === "approved") kycApprovedQueryRefetch();
                else kycRejectedQueryRefetch();
              }}
              disabled={loading}
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
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (tab === "pending") kycPendingQueryRefetch();
                else if (tab === "approved") kycApprovedQueryRefetch();
                else kycRejectedQueryRefetch();
              }}
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
            setReviewId={setReviewId}
            reviewId={reviewId}
            approveState={approveState}
            rejectState={rejectState}
          />
        </CardContent>
      </Card>
    </div>
  );
}
