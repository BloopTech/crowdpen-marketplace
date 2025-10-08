"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { toggleMerchant } from "./actions";
import Link from "next/link";

export default function MerchantsPage() {
  const { merchantsQuery } = useAdmin();

  useEffect(() => {
    // Fetch on mount
    merchantsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const merchants = merchantsQuery?.data?.merchants || [];
  const applicants = merchantsQuery?.data?.applicants || [];
  const loading = merchantsQuery?.isFetching || merchantsQuery?.isLoading;
  const error = merchantsQuery?.error?.message;

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Merchants</CardTitle>
            <Button onClick={() => merchantsQuery.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-red-600 text-sm">{error}</div> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchants.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name || "Unnamed"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="capitalize">{u.role}</TableCell>
                  <TableCell>{u.creator ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {u.creator ? (
                        <form action={toggleMerchant}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="makeMerchant" value="false" />
                          <Button size="sm" variant="outline">Remove Merchant</Button>
                        </form>
                      ) : (
                        <form action={toggleMerchant}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="makeMerchant" value="true" />
                          <Button size="sm">Make Merchant</Button>
                        </form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && merchants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No merchants yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applicants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicants.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k?.User?.name || k?.User?.email}</TableCell>
                  <TableCell className="capitalize">{k.status}</TableCell>
                  <TableCell className="capitalize">{k.level}</TableCell>
                  <TableCell>{k.submitted_at ? new Date(k.submitted_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    <Link className="text-primary underline text-xs" href="/admin/kyc">Review KYC</Link>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && applicants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No applicants yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
