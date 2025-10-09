"use client";

import React, { useEffect, useState } from "react";
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
import { Badge } from "../../components/ui/badge";
import { toggleMerchant } from "./actions";
import Link from "next/link";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";

export default function MerchantsPage() {
  const { merchantsQuery, merchantsParams, setMerchantsParams } = useAdmin();
  const [tab, setTab] = useState("merchants");

  // nuqs: sync page, pageSize, q with URL
  const [qs, setQs] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
      q: parseAsString.withDefault(""),
      tab: parseAsString.withDefault("merchants"),
    },
    { clearOnDefault: true }
  );

  useEffect(() => {
    // Initialize from URL query state on mount
    setTab(qs.tab);
    setMerchantsParams((prev) => ({
      ...prev,
      page: qs.page,
      pageSize: qs.pageSize,
      q: qs.q,
    }));
    merchantsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const merchants = merchantsQuery?.data?.merchants || [];
  const applicants = merchantsQuery?.data?.applicants || [];
  const page = merchantsQuery?.data?.page || merchantsParams.page || 1;
  const pageSize =
    merchantsQuery?.data?.pageSize || merchantsParams.pageSize || 20;
  const merchantsTotal = merchantsQuery?.data?.merchantsTotal || 0;
  const applicantsTotal = merchantsQuery?.data?.applicantsTotal || 0;
  const total = tab === "merchants" ? merchantsTotal : applicantsTotal;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const loading = merchantsQuery?.isFetching || merchantsQuery?.isLoading;
  const error = merchantsQuery?.error?.message;

  const toPage = (p) => {
    const np = Math.min(Math.max(p, 1), totalPages);
    setMerchantsParams((prev) => ({ ...prev, page: np }));
    setQs({ page: np });
    merchantsQuery.refetch();
  };

  // nuqs already declared above

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Merchants & Applicants</CardTitle>
            <Button onClick={() => merchantsQuery.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1">Search</label>
              <input
                type="text"
                placeholder="Name or email"
                value={merchantsParams.q || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setMerchantsParams((p) => ({ ...p, page: 1, q: v }));
                  setQs({ q: v, page: 1 });
                }}
                className="border border-slate-300 rounded px-2 py-2 text-sm min-w-56"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMerchantsParams((p) => ({ ...p, page: 1, pageSize: v }));
                  setQs({ pageSize: v, page: 1 });
                }}
                className="border border-slate-300 rounded px-2 py-2 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button variant="outline" onClick={() => merchantsQuery.refetch()}>
              Apply
            </Button>
          </div>
          {error ? <div className="text-red-600 text-sm">{error}</div> : null}
          <Tabs
            defaultValue="merchants"
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setQs({ tab: v });
            }}
          >
            <TabsList>
              <TabsTrigger value="merchants">Merchants</TabsTrigger>
              <TabsTrigger value="applicants">Applicants</TabsTrigger>
            </TabsList>

            <TabsContent value="merchants">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchants.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            imageUrl={u.image}
                            color={u.color}
                            className="h-8 w-8"
                          >
                            <AvatarFallback>
                              {(u?.name || u?.email || "")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {u.name || "Unnamed"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="capitalize">{u.role}</TableCell>
                      <TableCell>
                        <Badge variant={u.creator ? "success" : "neutral"}>
                          {u.creator ? "Merchant" : "Not Merchant"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {u.creator ? (
                            <form action={toggleMerchant}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input
                                type="hidden"
                                name="makeMerchant"
                                value="false"
                              />
                              <Button size="sm" variant="outline">
                                Remove Merchant
                              </Button>
                            </form>
                          ) : (
                            <form action={toggleMerchant}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input
                                type="hidden"
                                name="makeMerchant"
                                value="true"
                              />
                              <Button size="sm">Make Merchant</Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && merchants.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No merchants yet.
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
                        disabled={page <= 1}
                        onClick={(e) => {
                          e.preventDefault();
                          toPage(page - 1);
                        }}
                      />
                    </PaginationItem>
                    <span className="px-3 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        disabled={page >= totalPages}
                        onClick={(e) => {
                          e.preventDefault();
                          toPage(page + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </TabsContent>

            <TabsContent value="applicants">
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
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            imageUrl={k?.User?.image}
                            color={k?.User?.color}
                            className="h-8 w-8"
                          >
                            <AvatarFallback>
                              {(k?.User?.name || k?.User?.email || "")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {k?.User?.name || k?.User?.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {k?.User?.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            k.status === "approved"
                              ? "success"
                              : k.status === "rejected"
                                ? "error"
                                : "warning"
                          }
                        >
                          {k.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{k.level}</TableCell>
                      <TableCell>
                        {k.submitted_at
                          ? new Date(k.submitted_at).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Link
                          className="text-primary underline text-xs"
                          href="/admin/kyc"
                        >
                          Review KYC
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && applicants.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No applicants yet.
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
                        disabled={page <= 1}
                        onClick={(e) => {
                          e.preventDefault();
                          toPage(page - 1);
                        }}
                      />
                    </PaginationItem>
                    <span className="px-3 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        disabled={page >= totalPages}
                        onClick={(e) => {
                          e.preventDefault();
                          toPage(page + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
