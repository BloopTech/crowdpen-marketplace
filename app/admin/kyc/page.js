"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { approveKyc, rejectKyc } from "./actions";

export default function KycPage() {
  const { kycPendingQuery, kycApprovedQuery, kycRejectedQuery } = useAdmin();

  useEffect(() => {
    kycPendingQuery.refetch();
    kycApprovedQuery.refetch();
    kycRejectedQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = kycPendingQuery?.data?.data || [];
  const approved = kycApprovedQuery?.data?.data || [];
  const rejected = kycRejectedQuery?.data?.data || [];

  const loading =
    kycPendingQuery?.isFetching ||
    kycApprovedQuery?.isFetching ||
    kycRejectedQuery?.isFetching;

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>KYC - Pending</CardTitle>
            <Button onClick={() => { kycPendingQuery.refetch(); }} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                  <TableCell>{r?.User?.name || r?.User?.email || r.user_id}</TableCell>
                  <TableCell className="capitalize">{r.level}</TableCell>
                  <TableCell>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <form action={approveKyc}>
                        <input type="hidden" name="kycId" value={r.id} />
                        <Button size="sm">Approve</Button>
                      </form>
                      <form action={rejectKyc} className="flex items-center gap-2">
                        <input type="hidden" name="kycId" value={r.id} />
                        <input
                          type="text"
                          name="reason"
                          placeholder="Reason (optional)"
                          className="border border-slate-300 rounded px-2 py-1 text-sm"
                        />
                        <Button size="sm" variant="outline">Reject</Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No pending KYC.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KYC - Approved</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell>{r?.User?.name || r?.User?.email || r.user_id}</TableCell>
                  <TableCell className="capitalize">{r.level}</TableCell>
                  <TableCell>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{r.reviewed_by || "-"}</TableCell>
                </TableRow>
              ))}
              {approved.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No approved KYC.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KYC - Rejected</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reviewed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rejected.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r?.User?.name || r?.User?.email || r.user_id}</TableCell>
                  <TableCell>{r.rejection_reason || "-"}</TableCell>
                  <TableCell>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
              {rejected.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No rejected KYC.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
