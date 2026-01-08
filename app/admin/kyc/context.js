"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useActionState,
} from "react";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { toast } from "sonner";
import { approveKyc, rejectKyc, reopenKyc } from "./actions";
import { useAdmin } from "../context";

const rejectInitialState = {
  message: "",
  success: [],
};

const approveInitialState = {
  message: "",
  success: [],
};

const reopenInitialState = {
  message: "",
  success: [],
};

const AdminKycContext = createContext(undefined);

export function AdminKycProvider({ children }) {
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
  const [reopenState, reopenFormAction, reopenIsPending] = useActionState(
    reopenKyc,
    reopenInitialState
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
      kycRejectedQueryRefetch();
    } else if (
      Object.keys(approveState?.error || {}).length > 0 &&
      approveState.message
    ) {
      toast.error(approveState.message);
    }
  }, [
    kycApprovedQueryRefetch,
    kycPendingQueryRefetch,
    kycRejectedQueryRefetch,
    approveState,
  ]);

  useEffect(() => {
    if (
      Object.keys(reopenState?.data || {}).length > 0 &&
      reopenState.message
    ) {
      toast.success(reopenState.message);
      kycApprovedQueryRefetch();
      kycPendingQueryRefetch();
      kycRejectedQueryRefetch();
    } else if (
      Object.keys(reopenState?.error || {}).length > 0 &&
      reopenState.message
    ) {
      toast.error(reopenState.message);
    }
  }, [
    kycApprovedQueryRefetch,
    kycPendingQueryRefetch,
    kycRejectedQueryRefetch,
    reopenState,
  ]);

  useEffect(() => {
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

  const pending = useMemo(
    () => kycPendingQueryData?.data || [],
    [kycPendingQueryData]
  );
  const approved = useMemo(
    () => kycApprovedQueryData?.data || [],
    [kycApprovedQueryData]
  );
  const rejected = useMemo(
    () => kycRejectedQueryData?.data || [],
    [kycRejectedQueryData]
  );

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

  const reviewers = useMemo(
    () => usersQuery?.data?.data || [],
    [usersQuery?.data]
  );

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

  const value = useMemo(
    () => ({
      tab,
      setTab: (nextTab) => {
        setTab(nextTab);
        setQs({ kycTab: nextTab });
      },
      reviewId,
      setReviewId: (id) => {
        setReviewId(id);
        setQs({ kycReviewId: id });
      },
      qs,
      setQs,
      pending,
      approved,
      rejected,
      pendingPage,
      pendingTotalPages,
      approvedPage,
      approvedTotalPages,
      rejectedPage,
      rejectedTotalPages,
      setKycPendingParams,
      setKycApprovedParams,
      setKycRejectedParams,
      setCurrentParams,
      currentParams,
      kycPendingQueryRefetch,
      kycApprovedQueryRefetch,
      kycRejectedQueryRefetch,
      loading,
      reviewers,
      rejectFormAction,
      rejectIsPending,
      approveFormAction,
      approveIsPending,
      reopenFormAction,
      reopenIsPending,
      approveState,
      rejectState,
      reopenState,
    }),
    [
      tab,
      reviewId,
      qs,
      pending,
      approved,
      rejected,
      pendingPage,
      pendingTotalPages,
      approvedPage,
      approvedTotalPages,
      rejectedPage,
      rejectedTotalPages,
      setKycPendingParams,
      setKycApprovedParams,
      setKycRejectedParams,
      setCurrentParams,
      currentParams,
      kycPendingQueryRefetch,
      kycApprovedQueryRefetch,
      kycRejectedQueryRefetch,
      loading,
      reviewers,
      rejectFormAction,
      rejectIsPending,
      approveFormAction,
      approveIsPending,
      reopenFormAction,
      reopenIsPending,
      approveState,
      rejectState,
      reopenState,
      setQs,
    ]
  );

  return (
    <AdminKycContext.Provider value={value}>
      {children}
    </AdminKycContext.Provider>
  );
}

export function useAdminKyc() {
  const ctx = useContext(AdminKycContext);
  if (!ctx) {
    throw new Error("useAdminKyc must be used within an AdminKycProvider");
  }
  return ctx;
}
