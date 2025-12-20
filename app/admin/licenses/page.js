"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../context";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
PaginationSmart
} from "../../components/ui/pagination";
import { revokeLicense } from "./actions";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { useQueryStates, parseAsInteger } from "nuqs";

export default function LicensesPage() {
  const { licensesQuery, licensesParams, setLicensesParams } = useAdmin();
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    setLicensesParams((p) => ({ ...p, page: qs.page, pageSize: qs.pageSize }));
    licensesQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = licensesQuery?.data?.data || [];
  const loading = licensesQuery?.isFetching || licensesQuery?.isLoading;
  const page = licensesQuery?.data?.page || licensesParams.page || 1;
  const pageSize =
    licensesQuery?.data?.pageSize || licensesParams.pageSize || 20;
  const total = licensesQuery?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLicensesParams((p) => ({ ...p, page: 1, pageSize: v }));
                  setQs({ pageSize: v, page: 1 });
                }}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button variant="outline" onClick={() => licensesQuery.refetch()}>
              Apply
            </Button>
          </div>
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
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        imageUrl={it?.user?.image}
                        color={it?.user?.color}
                        className="h-8 w-8"
                      >
                        <AvatarFallback>
                          {(it?.user?.name || it?.user?.email || "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {it?.user?.name || it?.user?.email || it?.user?.id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {it?.user?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{it?.product?.title || it?.product?.id}</TableCell>
                  <TableCell className="max-w-[320px] truncate">
                    {it.downloadUrl || "-"}
                  </TableCell>
                  <TableCell>{it.downloadCount || 0}</TableCell>
                  <TableCell>
                    {it.lastDownloaded
                      ? new Date(it.lastDownloaded).toLocaleString("en-US", { timeZone: "UTC" })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <form action={revokeLicense}>
                      <input type="hidden" name="orderItemId" value={it.id} />
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={
                          (it?.downloadUrl || "").toString().toUpperCase() ===
                          "REVOKED"
                        }
                      >
                        Revoke
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No licenses found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4">
            <PaginationSmart
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(np) => {
                setLicensesParams((p) => ({ ...p, page: np }));
                setQs({ page: np });
                licensesQuery.refetch();
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
