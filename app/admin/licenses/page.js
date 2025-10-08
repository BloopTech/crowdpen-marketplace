"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { revokeLicense } from "./actions";

export default function LicensesPage() {
  const { licensesQuery } = useAdmin();

  useEffect(() => {
    licensesQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = licensesQuery?.data?.data || [];
  const loading = licensesQuery?.isFetching || licensesQuery?.isLoading;

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Licenses</CardTitle>
            <Button onClick={() => licensesQuery.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Download URL</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Last Download</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it?.user?.name || it?.user?.email || it?.user?.id}</TableCell>
                  <TableCell>{it?.product?.title || it?.product?.id}</TableCell>
                  <TableCell className="max-w-[320px] truncate">{it.downloadUrl || "-"}</TableCell>
                  <TableCell>{it.downloadCount || 0}</TableCell>
                  <TableCell>{it.lastDownloaded ? new Date(it.lastDownloaded).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    <form action={revokeLicense}>
                      <input type="hidden" name="orderItemId" value={it.id} />
                      <Button size="sm" variant="destructive" disabled={!it.downloadUrl}>Revoke</Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No licenses found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
