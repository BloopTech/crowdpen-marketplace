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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../../components/ui/pagination";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogAction,
} from "../../components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
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
    setReviewId,
    reviewId,
    approveState,
    rejectState,
  } = props;
  const {
    kycPendingQueryRefetch,
    kycApprovedQueryRefetch,
    kycRejectedQueryRefetch,
  } = useAdmin();
  const [rejectReasons, setRejectReasons] = useState({});

  // Auto-close the review dialog when an action succeeds for the current record
  useEffect(() => {
    if (approveState?.success && approveState?.data?.id && reviewId === approveState.data.id) {
      setReviewId("");
      setQs({ kycReviewId: "" });
    }
  }, [approveState, reviewId, setReviewId, setQs]);
  useEffect(() => {
    if (rejectState?.success && rejectState?.data?.id && reviewId === rejectState.data.id) {
      setReviewId("");
      setQs({ kycReviewId: "" });
    }
  }, [rejectState, reviewId, setReviewId, setQs]);
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
      >
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={r?.User?.image}
                        color={r?.User?.color}
                        className="h-8 w-8"
                      >
                        <AvatarFallback>
                          {(r?.User?.name || r?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {r?.User?.name || r?.User?.email || r.user_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{r.level}</TableCell>
                  <TableCell>
                    {r.submitted_at
                      ? new Date(r.submitted_at).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewId(r.id);
                          setQs({ kycReviewId: r.id });
                        }}
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
                        <DialogContent className="mx-auto w-full max-w-3xl font-poynterroman flex flex-col gap-6">
                          <DialogHeader>
                            <DialogTitle>KYC Review</DialogTitle>
                          </DialogHeader>
                          <Tabs
                            defaultValue="info"
                            className="flex flex-col gap-4"
                          >
                            <TabsList>
                              <TabsTrigger value="info">Info</TabsTrigger>
                              <TabsTrigger value="docs">Documents</TabsTrigger>
                              <TabsTrigger value="decision">
                                Decision
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="info">
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
                                    ? new Date(r.dob).toLocaleDateString()
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
                            <TabsContent value="docs">
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
                            <TabsContent value="decision">
                              <div className="flex flex-col gap-3">
                                {/* Approve flow with confirmation */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      type="button"
                                      disabled={rejectIsPending || approveIsPending}
                                      aria-busy={approveIsPending}
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
                                  <AlertDialogContent>
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
                                        <AlertDialogAction asChild>
                                          <button type="submit" disabled={rejectIsPending || approveIsPending} aria-busy={approveIsPending}>
                                            {approveIsPending ? (
                                              <span className="inline-flex items-center">
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Confirming...
                                              </span>
                                            ) : (
                                              "Confirm"
                                            )}
                                          </button>
                                        </AlertDialogAction>
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
                                    className="border border-slate-300 rounded px-2 py-2 text-sm flex-1"
                                    value={rejectReasons[r.id] || ""}
                                    onChange={(e) =>
                                      setRejectReasons((prev) => ({ ...prev, [r.id]: e.target.value }))
                                    }
                                  />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={rejectIsPending || approveIsPending}
                                        aria-busy={rejectIsPending}
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
                                    <AlertDialogContent>
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
                                          <AlertDialogAction asChild>
                                            <button type="submit" disabled={!rejectReasons[r.id] || rejectIsPending || approveIsPending} aria-busy={rejectIsPending}>
                                              {rejectIsPending ? (
                                                <span className="inline-flex items-center">
                                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                  Confirming...
                                                </span>
                                              ) : (
                                                "Confirm"
                                              )}
                                            </button>
                                          </AlertDialogAction>
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
                                <div className="mt-2 text-xs text-slate-600">
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
                                    Reviewed at: {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}
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
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No pending KYC.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.max(1, pendingPage - 1);
                      setKycPendingParams((p) => ({ ...p, page: np }));
                      setQs({ pendingPage: np });
                      kycPendingQueryRefetch();
                    }}
                    disabled={pendingPage <= 1}
                  />
                </PaginationItem>
                <span className="px-3 text-sm">
                  Page {pendingPage} of {pendingTotalPages}
                </span>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.min(pendingTotalPages, pendingPage + 1);
                      setKycPendingParams((p) => ({ ...p, page: np }));
                      setQs({ pendingPage: np });
                      kycPendingQueryRefetch();
                    }}
                    disabled={pendingPage >= pendingTotalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </TabsContent>

        <TabsContent value="approved">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Reviewed At</TableHead>
                <TableHead>Reviewer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={r?.User?.image}
                        color={r?.User?.color}
                        className="h-8 w-8"
                      >
                        <AvatarFallback>
                          {(r?.User?.name || r?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {r?.User?.name || r?.User?.email || r.user_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{r.level}</TableCell>
                  <TableCell>
                    {r.reviewed_at
                      ? new Date(r.reviewed_at).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
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
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No approved KYC.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.max(1, approvedPage - 1);
                      setKycApprovedParams((p) => ({ ...p, page: np }));
                      setQs({ approvedPage: np });
                      kycApprovedQueryRefetch();
                    }}
                    disabled={approvedPage <= 1}
                  />
                </PaginationItem>
                <span className="px-3 text-sm">
                  Page {approvedPage} of {approvedTotalPages}
                </span>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    disabled={approvedPage >= approvedTotalPages}
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.min(approvedTotalPages, approvedPage + 1);
                      setKycApprovedParams((p) => ({ ...p, page: np }));
                      setQs({ approvedPage: np });
                      kycApprovedQueryRefetch();
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </TabsContent>

        <TabsContent value="rejected">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reviewed At</TableHead>
                <TableHead>Reviewer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rejected.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={r?.User?.image}
                        color={r?.User?.color}
                        className="h-8 w-8"
                      >
                        <AvatarFallback>
                          {(r?.User?.name || r?.User?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {r?.User?.name || r?.User?.email || r.user_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r?.User?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{r.rejection_reason || "-"}</TableCell>
                  <TableCell>
                    {r.reviewed_at
                      ? new Date(r.reviewed_at).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
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
              {rejected.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No rejected KYC.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.max(1, rejectedPage - 1);
                      setKycRejectedParams((p) => ({ ...p, page: np }));
                      setQs({ rejectedPage: np });
                      kycRejectedQueryRefetch();
                    }}
                    disabled={rejectedPage <= 1}
                  />
                </PaginationItem>
                <span className="px-3 text-sm">
                  Page {rejectedPage} of {rejectedTotalPages}
                </span>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const np = Math.min(rejectedTotalPages, rejectedPage + 1);
                      setKycRejectedParams((p) => ({ ...p, page: np }));
                      setQs({ rejectedPage: np });
                      kycRejectedQueryRefetch();
                    }}
                    disabled={rejectedPage >= rejectedTotalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </TabsContent>
      </Tabs>
      </TooltipProvider>
    </>
  );
}
