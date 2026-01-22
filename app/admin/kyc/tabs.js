"use client";
import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  PaginationSmart
} from "../../components/ui/pagination";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useAdmin } from "../context";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "../../components/ui/alert-dialog";
import { TooltipProvider } from "../../components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../components/ui/hover-card";

export default function KYCTabs(props) {
  const {
    tab,
    setTab,
    setQs,
    pending,
    setKycPendingParams,
    rejected,
    rejectedPage,
    rejectedTotalPages,
    approved,
    approvedPage,
    approvedTotalPages,
    pendingPage,
    pendingTotalPages,
    setKycRejectedParams,
    setKycApprovedParams,
    rejectFormAction,
    rejectIsPending,
    approveFormAction,
    approveIsPending,
    reopenFormAction,
    reopenIsPending,
    setReviewId,
    reviewId,
    approveState,
    rejectState,
    reopenState,
  } = props;
  const {
    kycPendingQueryRefetch,
    kycApprovedQueryRefetch,
    kycRejectedQueryRefetch,
  } = useAdmin();
  const [rejectReasons, setRejectReasons] = useState({});
  const [approveConfirmOpen, setApproveConfirmOpen] = useState({});
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState({});

  // Auto-close the review dialog when an action succeeds for the current record
  useEffect(() => {
    if (approveState?.success && approveState?.data?.id && reviewId === approveState.data.id) {
      setReviewId("");
      setQs({ kycReviewId: "" });
    }
    if (approveState?.success && approveState?.data?.id) {
      const id = approveState.data.id;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApproveConfirmOpen((prev) => ({ ...prev, [id]: false }));
      setRejectConfirmOpen((prev) => ({ ...prev, [id]: false }));
    }
  }, [approveState, reviewId, setReviewId, setQs]);
  useEffect(() => {
    if (rejectState?.success && rejectState?.data?.id && reviewId === rejectState.data.id) {
      setReviewId("");
      setQs({ kycReviewId: "" });
    }
    if (rejectState?.success && rejectState?.data?.id) {
      const id = rejectState.data.id;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRejectConfirmOpen((prev) => ({ ...prev, [id]: false }));
      setApproveConfirmOpen((prev) => ({ ...prev, [id]: false }));
    }
  }, [rejectState, reviewId, setReviewId, setQs]);

  useEffect(() => {
    if (reopenState?.success && reopenState?.data?.id && reviewId === reopenState.data.id) {
      setReviewId("");
      setQs({ kycReviewId: "" });
    }
  }, [reopenState, reviewId, setReviewId, setQs]);
  return (
    <>
      <TooltipProvider>
      <Tabs
        defaultValue="pending"
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setQs({ kycTab: v });
        }}
        data-testid="admin-kyc-tabs"
      >
        <TabsList data-testid="admin-kyc-tabs-list">
          <TabsTrigger value="pending" data-testid="admin-kyc-tab-pending">Pending</TabsTrigger>
          <TabsTrigger value="approved" data-testid="admin-kyc-tab-approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="admin-kyc-tab-rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" data-testid="admin-kyc-pending">
          <Table data-testid="admin-kyc-pending-table">
            <TableHeader data-testid="admin-kyc-pending-head">
              <TableRow data-testid="admin-kyc-pending-head-row">
                <TableHead data-testid="admin-kyc-pending-head-user">User</TableHead>
                <TableHead data-testid="admin-kyc-pending-head-level">Level</TableHead>
                <TableHead data-testid="admin-kyc-pending-head-submitted">Submitted</TableHead>
                <TableHead data-testid="admin-kyc-pending-head-actions">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="admin-kyc-pending-body">
              {pending.map((r) => (
                <TableRow key={r.id} data-testid={`admin-kyc-pending-row-${r.id}`}>
                  <TableCell data-testid={`admin-kyc-pending-row-${r.id}-user`}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={r?.User?.image}
                        color={r?.User?.color}
                        className="h-8 w-8"
                        data-testid={`admin-kyc-pending-row-${r.id}-avatar`}
                      >
                        <AvatarFallback>
                          {(r?.User?.name || r?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className="font-medium"
                          data-testid={`admin-kyc-pending-row-${r.id}-user-name`}
                        >
                          {r?.User?.name || r?.User?.email || r.user_id}
                        </div>
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid={`admin-kyc-pending-row-${r.id}-user-email`}
                        >
                          {r?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    className="capitalize"
                    data-testid={`admin-kyc-pending-row-${r.id}-level`}
                  >
                    {r.level}
                  </TableCell>
                  <TableCell data-testid={`admin-kyc-pending-row-${r.id}-submitted`}>
                    {r.submitted_at
                      ? new Date(r.submitted_at).toLocaleString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-kyc-pending-row-${r.id}-actions`}>
                    <div className="flex gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewId(r.id);
                          setQs({ kycReviewId: r.id });
                        }}
                        data-testid={`admin-kyc-pending-review-${r.id}`}
                      >
                        Review
                      </Button>
                      <Dialog
                        open={reviewId === r.id}
                        onOpenChange={(o) => {
                          if (!o) {
                            setReviewId("");
                            setQs({ kycReviewId: "" });
                          }
                        }}
                      >
                        <DialogContent
                          className="mx-auto w-full max-w-3xl font-poynterroman flex flex-col gap-6"
                          data-testid={`admin-kyc-review-dialog-${r.id}`}
                        >
                          <DialogHeader>
                            <DialogTitle>KYC Review</DialogTitle>
                          </DialogHeader>
                          <Tabs
                            defaultValue="info"
                            className="flex flex-col gap-4"
                            data-testid={`admin-kyc-review-tabs-${r.id}`}
                          >
                            <TabsList data-testid={`admin-kyc-review-tabs-list-${r.id}`}>
                              <TabsTrigger value="info" data-testid={`admin-kyc-review-tab-info-${r.id}`}>
                                Info
                              </TabsTrigger>
                              <TabsTrigger value="docs" data-testid={`admin-kyc-review-tab-docs-${r.id}`}>
                                Documents
                              </TabsTrigger>
                              <TabsTrigger value="decision" data-testid={`admin-kyc-review-tab-decision-${r.id}`}>
                                Decision
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="info" data-testid={`admin-kyc-review-info-${r.id}`}>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground font-semibold">
                                    Name:
                                  </span>{" "}
                                  {r.first_name} {r.last_name}
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">
                                    Email:
                                  </span>{" "}
                                  {r?.User?.email}
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">
                                    Level:
                                  </span>{" "}
                                  {r.level}
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">
                                    Status:
                                  </span>{" "}
                                  {r.status}
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">
                                    Phone:
                                  </span>{" "}
                                  {r.phone_number || "-"}
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">
                                    DOB:
                                  </span>{" "}
                                  {r.dob
                                    ? new Date(r.dob).toLocaleDateString("en-US", { timeZone: "UTC" })
                                    : "-"}
                                </div>
                                <div className="col-span-2">
                                  <span className="text-muted-foreground font-semibold">
                                    Address:
                                  </span>{" "}
                                  {r.address_line1} {r.address_line2} {r.city}{" "}
                                  {r.state} {r.postal_code} {r.country}
                                </div>
                              </div>
                            </TabsContent>
                            <TabsContent value="docs" data-testid={`admin-kyc-review-docs-${r.id}`}>
                              <div className="grid grid-cols-3 gap-4 w-full">
                                <div>
                                  <h1 className="font-medium font-poynterroman mt-1">
                                    ID Front
                                  </h1>
                                  {r.id_front_url ? (
                                    <Link
                                      href={r.id_front_url}
                                      target="_blank"
                                      className="block"
                                      data-testid={`admin-kyc-review-id-front-${r.id}`}
                                    >
                                      <Image
                                        src={r.id_front_url}
                                        alt="ID Front"
                                        width={200}
                                        height={200}
                                        className="object-cover rounded border border-[#d3a155]"
                                        unoptimized
                                        priority
                                      />
                                    </Link>
                                  ) : null}
                                </div>

                                <div>
                                  <h1 className="font-medium mt-1 font-poynterroman">
                                    ID Back
                                  </h1>
                                  {r.id_back_url ? (
                                    <Link
                                      href={r.id_back_url}
                                      target="_blank"
                                      className="block"
                                      data-testid={`admin-kyc-review-id-back-${r.id}`}
                                    >
                                      <Image
                                        src={r.id_back_url}
                                        alt="ID Back"
                                        width={200}
                                        height={200}
                                        className="border-[#d3a155] object-cover rounded border"
                                        unoptimized
                                        priority
                                      />
                                    </Link>
                                  ) : null}
                                </div>

                                <div>
                                  <h1 className="font-medium mt-1 font-poynterroman">
                                    Selfie
                                  </h1>
                                  {r.selfie_url ? (
                                    <Link
                                      href={r.selfie_url}
                                      target="_blank"
                                      className="block"
                                      data-testid={`admin-kyc-review-selfie-${r.id}`}
                                    >
                                      <Image
                                        src={r.selfie_url}
                                        alt="Selfie"
                                        width={200}
                                        height={200}
                                        className="object-cover rounded border border-[#d3a155]"
                                        unoptimized
                                        priority
                                      />
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            </TabsContent>
                            <TabsContent value="decision" data-testid={`admin-kyc-review-decision-${r.id}`}>
                              <div className="flex flex-col gap-3">
                                {/* Approve flow with confirmation */}
                                <AlertDialog
                                  open={!!approveConfirmOpen[r.id]}
                                  onOpenChange={(o) =>
                                    setApproveConfirmOpen((prev) => ({ ...prev, [r.id]: o }))
                                  }
                                >
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      type="button"
                                      disabled={rejectIsPending || approveIsPending}
                                      aria-busy={approveIsPending}
                                      data-testid={`admin-kyc-approve-${r.id}`}
                                    >
                                      {approveIsPending ? (
                                        <span className="inline-flex items-center">
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Approving...
                                        </span>
                                      ) : (
                                        "Approve"
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent data-testid={`admin-kyc-approve-confirm-${r.id}`}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve verification?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will mark the user as verified and send them an email notification.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <form action={approveFormAction}>
                                      <input type="hidden" name="kycId" value={r.id} />
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <Button
                                          type="submit"
                                          disabled={rejectIsPending || approveIsPending}
                                          aria-busy={approveIsPending}
                                          data-testid={`admin-kyc-approve-confirm-submit-${r.id}`}
                                        >
                                          {approveIsPending ? (
                                            <span className="inline-flex items-center">
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Confirming...
                                            </span>
                                          ) : (
                                            "Confirm"
                                          )}
                                        </Button>
                                      </AlertDialogFooter>
                                    </form>
                                  </AlertDialogContent>
                                </AlertDialog>

                                {/* Reject flow with controlled reason and confirmation */}
                                <div className="flex items-center gap-2">
                                  <input
                                    disabled={rejectIsPending || approveIsPending}
                                    type="text"
                                    placeholder="Reason (required)"
                                    required
                                    aria-required="true"
                                    className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-ring"
                                    value={rejectReasons[r.id] || ""}
                                    onChange={(e) =>
                                      setRejectReasons((prev) => ({ ...prev, [r.id]: e.target.value }))
                                    }
                                    data-testid={`admin-kyc-reject-reason-${r.id}`}
                                  />
                                  <AlertDialog
                                    open={!!rejectConfirmOpen[r.id]}
                                    onOpenChange={(o) =>
                                      setRejectConfirmOpen((prev) => ({ ...prev, [r.id]: o }))
                                    }
                                  >
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={rejectIsPending || approveIsPending}
                                        aria-busy={rejectIsPending}
                                        data-testid={`admin-kyc-reject-${r.id}`}
                                      >
                                        {rejectIsPending ? (
                                          <span className="inline-flex items-center">
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Rejecting...
                                          </span>
                                        ) : (
                                          "Reject"
                                        )}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent data-testid={`admin-kyc-reject-confirm-${r.id}`}>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Reject verification?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Reason: {rejectReasons[r.id] || "(none)"}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <form action={rejectFormAction}>
                                        <input type="hidden" name="kycId" value={r.id} />
                                        <input type="hidden" name="reason" value={rejectReasons[r.id] || ""} />
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <Button
                                            type="submit"
                                            disabled={!rejectReasons[r.id] || rejectIsPending || approveIsPending}
                                            aria-busy={rejectIsPending}
                                            data-testid={`admin-kyc-reject-confirm-submit-${r.id}`}
                                          >
                                            {rejectIsPending ? (
                                              <span className="inline-flex items-center">
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Confirming...
                                              </span>
                                            ) : (
                                              "Confirm"
                                            )}
                                          </Button>
                                        </AlertDialogFooter>
                                      </form>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                                {(approveState?.success && approveState?.data?.id === r.id) && (
                                  <Alert className="mt-2">
                                    <CheckCircle className="h-5 w-5" />
                                    <AlertTitle>KYC approved</AlertTitle>
                                    <AlertDescription>
                                      {approveState?.data?.email?.sent
                                        ? "Notification email sent to the user."
                                        : approveState?.data?.email?.error
                                          ? `Email failed: ${approveState.data.email.error}`
                                          : ""}
                                    </AlertDescription>
                                  </Alert>
                                )}
                                {(rejectState?.success && rejectState?.data?.id === r.id) && (
                                  <Alert className="mt-2" variant="destructive">
                                    <AlertCircle className="h-5 w-5" />
                                    <AlertTitle>KYC rejected</AlertTitle>
                                    <AlertDescription>
                                      {rejectState?.data?.email?.sent
                                        ? "Notification email sent to the user."
                                        : rejectState?.data?.email?.error
                                          ? `Email failed: ${rejectState.data.email.error}`
                                          : "Decision submitted."}
                                  </AlertDescription>
                                  </Alert>
                                )}

                                {/* Activity log */}
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <span>Reviewed by:</span>
                                    <HoverCard>
                                      <HoverCardTrigger asChild>
                                        <div className="flex items-center gap-2 cursor-default">
                                          <Avatar
                                            imageUrl={r?.Reviewer?.image}
                                            color={r?.Reviewer?.color}
                                            className="h-6 w-6"
                                          >
                                            <AvatarFallback>
                                              {(r?.Reviewer?.name || r?.Reviewer?.email || "—")
                                                .slice(0, 2)
                                                .toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-sm">
                                            {r?.Reviewer?.name || r?.Reviewer?.email || r.reviewed_by || "—"}
                                          </span>
                                        </div>
                                      </HoverCardTrigger>
                                      <HoverCardContent>
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <Avatar
                                              imageUrl={r?.Reviewer?.image}
                                              color={r?.Reviewer?.color}
                                              className="h-6 w-6"
                                            >
                                              <AvatarFallback>
                                                {(r?.Reviewer?.name || r?.Reviewer?.email || "—")
                                                  .slice(0, 2)
                                                  .toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium">
                                              {r?.Reviewer?.name || r?.Reviewer?.email || "—"}
                                            </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {r?.Reviewer?.email || "-"}
                                          </div>
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                  </div>
                                  <div>
                                    Reviewed at: {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString("en-US", { timeZone: "UTC" }) : "—"}
                                  </div>
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pending.length === 0 && (
                <TableRow data-testid="admin-kyc-pending-empty">
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                    data-testid="admin-kyc-pending-empty-cell"
                  >
                    No pending KYC.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4">
            <PaginationSmart
              currentPage={pendingPage}
              totalPages={pendingTotalPages}
              onPageChange={(np) => {
                setKycPendingParams((p) => ({ ...p, page: np }));
                setQs({ pendingPage: np });
                kycPendingQueryRefetch();
              }}
              data-testid="admin-kyc-pending-pagination"
            />
          </div>
        </TabsContent>

        <TabsContent value="approved" data-testid="admin-kyc-approved">
          <Table data-testid="admin-kyc-approved-table">
            <TableHeader data-testid="admin-kyc-approved-head">
              <TableRow data-testid="admin-kyc-approved-head-row">
                <TableHead data-testid="admin-kyc-approved-head-user">User</TableHead>
                <TableHead data-testid="admin-kyc-approved-head-level">Level</TableHead>
                <TableHead data-testid="admin-kyc-approved-head-reviewed">Reviewed At</TableHead>
                <TableHead data-testid="admin-kyc-approved-head-reviewer">Reviewer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="admin-kyc-approved-body">
              {approved.map((r) => (
                <TableRow key={r.id} data-testid={`admin-kyc-approved-row-${r.id}`}>
                  <TableCell data-testid={`admin-kyc-approved-row-${r.id}-user`}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={r?.User?.image}
                        color={r?.User?.color}
                        className="h-8 w-8"
                        data-testid={`admin-kyc-approved-row-${r.id}-avatar`}
                      >
                        <AvatarFallback>
                          {(r?.User?.name || r?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className="font-medium"
                          data-testid={`admin-kyc-approved-row-${r.id}-user-name`}
                        >
                          {r?.User?.name || r?.User?.email || r.user_id}
                        </div>
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid={`admin-kyc-approved-row-${r.id}-user-email`}
                        >
                          {r?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    className="capitalize"
                    data-testid={`admin-kyc-approved-row-${r.id}-level`}
                  >
                    {r.level}
                  </TableCell>
                  <TableCell data-testid={`admin-kyc-approved-row-${r.id}-reviewed`}>
                    {r.reviewed_at
                      ? new Date(r.reviewed_at).toLocaleString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-kyc-approved-row-${r.id}-reviewer`}>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="flex items-center gap-2 cursor-default">
                          <Avatar
                            imageUrl={r?.Reviewer?.image}
                            color={r?.Reviewer?.color}
                            className="h-6 w-6"
                          >
                            <AvatarFallback>
                              {(r?.Reviewer?.name || r?.Reviewer?.email || "-")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {r?.Reviewer?.name || r?.Reviewer?.email || r.reviewed_by || "-"}
                          </span>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {r?.Reviewer?.name || r?.Reviewer?.email || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r?.Reviewer?.email || "-"}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                </TableRow>
              ))}
              {approved.length === 0 && (
                <TableRow data-testid="admin-kyc-approved-empty">
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                    data-testid="admin-kyc-approved-empty-cell"
                  >
                    No approved KYC.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4">
            <PaginationSmart
              currentPage={approvedPage}
              totalPages={approvedTotalPages}
              onPageChange={(np) => {
                setKycApprovedParams((p) => ({ ...p, page: np }));
                setQs({ approvedPage: np });
                kycApprovedQueryRefetch();
              }}
              data-testid="admin-kyc-approved-pagination"
            />
          </div>
        </TabsContent>

        <TabsContent value="rejected" data-testid="admin-kyc-rejected">
          <Table data-testid="admin-kyc-rejected-table">
            <TableHeader data-testid="admin-kyc-rejected-head">
              <TableRow data-testid="admin-kyc-rejected-head-row">
                <TableHead data-testid="admin-kyc-rejected-head-user">User</TableHead>
                <TableHead data-testid="admin-kyc-rejected-head-reason">Reason</TableHead>
                <TableHead data-testid="admin-kyc-rejected-head-reviewed">Reviewed At</TableHead>
                <TableHead data-testid="admin-kyc-rejected-head-reviewer">Reviewer</TableHead>
                <TableHead data-testid="admin-kyc-rejected-head-actions">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="admin-kyc-rejected-body">
              {rejected.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setRejectReasons((prev) => ({
                      ...prev,
                      [r.id]: r.rejection_reason || "",
                    }));
                    setReviewId(r.id);
                    setQs({ kycReviewId: r.id });
                  }}
                  data-testid={`admin-kyc-rejected-row-${r.id}`}
                >
                  <TableCell data-testid={`admin-kyc-rejected-row-${r.id}-user`}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={r?.User?.image}
                        color={r?.User?.color}
                        className="h-8 w-8"
                        data-testid={`admin-kyc-rejected-row-${r.id}-avatar`}
                      >
                        <AvatarFallback>
                          {(r?.User?.name || r?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className="font-medium"
                          data-testid={`admin-kyc-rejected-row-${r.id}-user-name`}
                        >
                          {r?.User?.name || r?.User?.email || r.user_id}
                        </div>
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid={`admin-kyc-rejected-row-${r.id}-user-email`}
                        >
                          {r?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`admin-kyc-rejected-row-${r.id}-reason`}>
                    {r.rejection_reason || "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-kyc-rejected-row-${r.id}-reviewed`}>
                    {r.reviewed_at
                      ? new Date(r.reviewed_at).toLocaleString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                  <TableCell data-testid={`admin-kyc-rejected-row-${r.id}-reviewer`}>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="flex items-center gap-2 cursor-default">
                          <Avatar
                            imageUrl={r?.Reviewer?.image}
                            color={r?.Reviewer?.color}
                            className="h-6 w-6"
                          >
                            <AvatarFallback>
                              {(r?.Reviewer?.name || r?.Reviewer?.email || "-")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {r?.Reviewer?.name || r?.Reviewer?.email || r.reviewed_by || "-"}
                          </span>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {r?.Reviewer?.name || r?.Reviewer?.email || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r?.Reviewer?.email || "-"}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`admin-kyc-rejected-row-${r.id}-actions`}
                  >
                    <div className="flex gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectReasons((prev) => ({
                            ...prev,
                            [r.id]: r.rejection_reason || "",
                          }));
                          setReviewId(r.id);
                          setQs({ kycReviewId: r.id });
                        }}
                        data-testid={`admin-kyc-rejected-review-${r.id}`}
                      >
                        Review / Update
                      </Button>
                      <Dialog
                        open={reviewId === r.id}
                        onOpenChange={(o) => {
                          if (!o) {
                            setReviewId("");
                            setQs({ kycReviewId: "" });
                          }
                        }}
                      >
                        <DialogContent
                          className="mx-auto w-full max-w-3xl font-poynterroman flex flex-col gap-6"
                          data-testid={`admin-kyc-rejected-dialog-${r.id}`}
                        >
                          <DialogHeader>
                            <DialogTitle data-testid={`admin-kyc-rejected-dialog-title-${r.id}`}>
                              Rejected KYC
                            </DialogTitle>
                          </DialogHeader>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground font-semibold">Name:</span>{" "}
                              {r.first_name} {r.last_name}
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold">Email:</span>{" "}
                              {r?.User?.email}
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold">Level:</span>{" "}
                              {r.level}
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold">Status:</span>{" "}
                              {r.status}
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold">Reviewed at:</span>{" "}
                              {r.reviewed_at
                                ? new Date(r.reviewed_at).toLocaleString("en-US", { timeZone: "UTC" })
                                : "-"}
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold">Reviewer:</span>{" "}
                              {r?.Reviewer?.name || r?.Reviewer?.email || r.reviewed_by || "-"}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 w-full">
                            <div>
                              <h1 className="font-medium font-poynterroman mt-1">ID Front</h1>
                              {r.id_front_url ? (
                                <Link
                                  href={r.id_front_url}
                                  target="_blank"
                                  className="block"
                                  data-testid={`admin-kyc-rejected-id-front-${r.id}`}
                                >
                                  <Image
                                    src={r.id_front_url}
                                    alt="ID Front"
                                    width={200}
                                    height={200}
                                    className="object-cover rounded border border-[#d3a155]"
                                    unoptimized
                                    priority
                                  />
                                </Link>
                              ) : null}
                            </div>

                            <div>
                              <h1 className="font-medium mt-1 font-poynterroman">ID Back</h1>
                              {r.id_back_url ? (
                                <Link
                                  href={r.id_back_url}
                                  target="_blank"
                                  className="block"
                                  data-testid={`admin-kyc-rejected-id-back-${r.id}`}
                                >
                                  <Image
                                    src={r.id_back_url}
                                    alt="ID Back"
                                    width={200}
                                    height={200}
                                    className="border-[#d3a155] object-cover rounded border"
                                    unoptimized
                                    priority
                                  />
                                </Link>
                              ) : null}
                            </div>

                            <div>
                              <h1 className="font-medium mt-1 font-poynterroman">Selfie</h1>
                              {r.selfie_url ? (
                                <Link
                                  href={r.selfie_url}
                                  target="_blank"
                                  className="block"
                                  data-testid={`admin-kyc-rejected-selfie-${r.id}`}
                                >
                                  <Image
                                    src={r.selfie_url}
                                    alt="Selfie"
                                    width={200}
                                    height={200}
                                    className="object-cover rounded border border-[#d3a155]"
                                    unoptimized
                                    priority
                                  />
                                </Link>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <input
                                disabled={rejectIsPending || approveIsPending || reopenIsPending}
                                type="text"
                                placeholder="Rejection reason (required)"
                                required
                                aria-required="true"
                                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-ring"
                                value={rejectReasons[r.id] || ""}
                                onChange={(e) =>
                                  setRejectReasons((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value,
                                  }))
                                }
                                data-testid={`admin-kyc-rejected-reason-${r.id}`}
                              />
                              <form action={rejectFormAction}>
                                <input type="hidden" name="kycId" value={r.id} />
                                <input
                                  type="hidden"
                                  name="reason"
                                  value={rejectReasons[r.id] || ""}
                                />
                                <Button
                                  type="submit"
                                  variant="outline"
                                  disabled={!rejectReasons[r.id] || rejectIsPending || approveIsPending || reopenIsPending}
                                  aria-busy={rejectIsPending}
                                  data-testid={`admin-kyc-rejected-update-${r.id}`}
                                >
                                  {rejectIsPending ? (
                                    <span className="inline-flex items-center">
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Updating...
                                    </span>
                                  ) : (
                                    "Update reason"
                                  )}
                                </Button>
                              </form>
                            </div>
                            <form action={approveFormAction}>
                              <input type="hidden" name="kycId" value={r.id} />
                              <Button
                                type="submit"
                                disabled={rejectIsPending || approveIsPending || reopenIsPending}
                                aria-busy={approveIsPending}
                                data-testid={`admin-kyc-rejected-approve-${r.id}`}
                              >
                                {approveIsPending ? (
                                  <span className="inline-flex items-center">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Approving...
                                  </span>
                                ) : (
                                  "Approve"
                                )}
                              </Button>
                            </form>

                            <form action={reopenFormAction}>
                              <input type="hidden" name="kycId" value={r.id} />
                              <Button
                                type="submit"
                                variant="secondary"
                                disabled={rejectIsPending || approveIsPending || reopenIsPending}
                                aria-busy={reopenIsPending}
                                data-testid={`admin-kyc-rejected-reopen-${r.id}`}
                              >
                                {reopenIsPending ? (
                                  <span className="inline-flex items-center">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Moving...
                                  </span>
                                ) : (
                                  "Move to pending"
                                )}
                              </Button>
                            </form>
                            {(approveState?.success && approveState?.data?.id === r.id) && (
                              <Alert className="mt-2">
                                <CheckCircle className="h-5 w-5" />
                                <AlertTitle>KYC approved</AlertTitle>
                                <AlertDescription>
                                  {approveState?.data?.email?.sent
                                    ? "Notification email sent to the user."
                                    : approveState?.data?.email?.error
                                      ? `Email failed: ${approveState.data.email.error}`
                                      : ""}
                                </AlertDescription>
                              </Alert>
                            )}
                            {(rejectState?.success && rejectState?.data?.id === r.id) && (
                              <Alert className="mt-2" variant="destructive">
                                <AlertCircle className="h-5 w-5" />
                                <AlertTitle>KYC updated</AlertTitle>
                                <AlertDescription>
                                  {rejectState?.data?.email?.sent
                                    ? "Notification email sent to the user."
                                    : rejectState?.data?.email?.error
                                      ? `Email failed: ${rejectState.data.email.error}`
                                      : "Decision submitted."}
                                </AlertDescription>
                              </Alert>
                            )}

                            {(reopenState?.success && reopenState?.data?.id === r.id) && (
                              <Alert className="mt-2">
                                <CheckCircle className="h-5 w-5" />
                                <AlertTitle>KYC moved to pending</AlertTitle>
                                <AlertDescription>
                                  This record is now back in the Pending tab for review.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rejected.length === 0 && (
                <TableRow data-testid="admin-kyc-rejected-empty">
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                    data-testid="admin-kyc-rejected-empty-cell"
                  >
                    No rejected KYC.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4">
            <PaginationSmart
              currentPage={rejectedPage}
              totalPages={rejectedTotalPages}
              onPageChange={(np) => {
                setKycRejectedParams((p) => ({ ...p, page: np }));
                setQs({ rejectedPage: np });
                kycRejectedQueryRefetch();
              }}
              data-testid="admin-kyc-rejected-pagination"
            />
          </div>
        </TabsContent>
      </Tabs>
      </TooltipProvider>
    </>
  );
}
