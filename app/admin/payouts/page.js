"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { createPayout } from "./actions";

export default function PayoutsPage() {
  const { payoutsQuery, usersQuery } = useAdmin();

  useEffect(() => {
    payoutsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = payoutsQuery?.data?.data || [];
  const users = usersQuery?.data?.data || [];
  const loading = payoutsQuery?.isFetching || payoutsQuery?.isLoading;

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payouts</CardTitle>
            <Button onClick={() => payoutsQuery.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form action={createPayout} className="flex flex-wrap items-end gap-2 mb-4">
            <div>
              <label className="block text-xs mb-1">Recipient</label>
              <select name="recipient_id" className="border border-slate-300 rounded px-2 py-2 text-sm min-w-48">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Amount</label>
              <input name="amount" placeholder="100" className="border border-slate-300 rounded px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1">Currency</label>
              <input name="currency" defaultValue="USD" className="border border-slate-300 rounded px-2 py-2 text-sm w-24" />
            </div>
            <div>
              <label className="block text-xs mb-1">Reference</label>
              <input name="transaction_reference" placeholder="optional" className="border border-slate-300 rounded px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1">Note</label>
              <input name="note" placeholder="optional" className="border border-slate-300 rounded px-2 py-2 text-sm" />
            </div>
            <Button type="submit">Create Payout</Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{tx?.User?.name || tx?.User?.email || tx.recipient_id}</TableCell>
                  <TableCell>{tx.amount}</TableCell>
                  <TableCell>{tx.currency}</TableCell>
                  <TableCell className="capitalize">{tx.status}</TableCell>
                  <TableCell>{tx.transaction_reference || "-"}</TableCell>
                  <TableCell>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No payouts yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
