"use client";

import React from "react";
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
import { PaginationSmart } from "../../components/ui/pagination";
import { Badge } from "../../components/ui/badge";
import Link from "next/link";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { toggleMerchant } from "./actions";
import { useAdminMerchants } from "./context";

export default function AdminMerchantsContent() {
  const {
    tab,
    setTab,
    merchants,
    applicants,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    searchValue,
    setSearch,
    setPageSize,
    toPage,
    refresh,
  } = useAdminMerchants();

  return (
    <div className="px-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Merchants & Applicants</CardTitle>
            <Button onClick={refresh} disabled={loading}>
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
                value={searchValue}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <Button variant="outline" onClick={refresh}>
              Apply
            </Button>
          </div>
          {error ? <div className="text-destructive text-sm">{error}</div> : null}
          <Tabs value={tab} onValueChange={setTab}>
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
                        <Badge variant={u.merchant ? "success" : "neutral"}>
                          {u.merchant ? "Merchant" : "Not Merchant"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <form action={toggleMerchant}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input
                              type="hidden"
                              name="makeMerchant"
                              value={u.merchant ? "false" : "true"}
                            />
                            <Button size="sm" variant={u.merchant ? "outline" : "default"}>
                              {u.merchant ? "Remove Merchant" : "Make Merchant"}
                            </Button>
                          </form>
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
                <PaginationSmart
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={toPage}
                />
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
                          ? new Date(k.submitted_at).toLocaleString("en-US", {
                              timeZone: "UTC",
                            })
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
                <PaginationSmart
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={toPage}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
