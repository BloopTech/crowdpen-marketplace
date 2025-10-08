"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export default function TransactionsPage() {
  const { transactionsQuery } = useAdmin();

  useEffect(() => {
    transactionsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = transactionsQuery?.data?.data || [];
  const loading = transactionsQuery?.isFetching || transactionsQuery?.isLoading;

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin Transactions</CardTitle>
            <Button onClick={() => transactionsQuery.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
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
                  <TableCell className="capitalize">{tx.trans_type}</TableCell>
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
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No transactions.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
