"use client";

import React, { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../../components/ui/dialog";
import {
  promoteToAdmin,
  demoteAdminToUser,
  promoteToSeniorAdmin,
  demoteSeniorAdminToAdmin,
} from "./actions";
import { useAdminRoles } from "./context";

export default function AdminRolesContent() {
  const { sessionUserId, isSenior, users, loading, error, refetch } = useAdminRoles();

  return (
    <div className="px-4" data-testid="admin-roles-page">
      <Card data-testid="admin-roles-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>User Roles</CardTitle>
            <div className="flex items-center gap-2">
              <AddRoleDialog isSenior={isSenior} onDone={() => refetch?.()} />
              <Button
                onClick={() => refetch?.()}
                disabled={loading}
                data-testid="admin-roles-refresh"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-destructive text-sm" data-testid="admin-roles-error">
              {error}
            </div>
          ) : null}
          <Table data-testid="admin-roles-table">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === sessionUserId;
                const isAdmin = u.role === "admin";
                const isSeniorAdmin = u.role === "senior_admin";
                const initials = (u?.name || u?.email || "").trim().slice(0, 2).toUpperCase();

                return (
                  <TableRow key={u.id} data-testid={`admin-role-row-${u.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar imageUrl={u.image} color={u.color}>
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{u.name || "Unnamed"}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>{u.crowdpen_staff ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {!isSelf && u.role === "user" && (
                          <form action={promoteToAdmin}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button size="sm" data-testid={`admin-role-make-admin-${u.id}`}>
                              Make Admin
                            </Button>
                          </form>
                        )}

                        {!isSelf && isAdmin && (
                          <form action={demoteAdminToUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`admin-role-remove-admin-${u.id}`}
                            >
                              Remove Admin
                            </Button>
                          </form>
                        )}

                        {!isSelf && isSenior && !isSeniorAdmin && (
                          <form action={promoteToSeniorAdmin}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button
                              size="sm"
                              variant="secondary"
                              data-testid={`admin-role-make-senior-${u.id}`}
                            >
                              Make Senior Admin
                            </Button>
                          </form>
                        )}

                        {!isSelf && isSenior && isSeniorAdmin && (
                          <form action={demoteSeniorAdminToAdmin}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button
                              size="sm"
                              variant="destructive"
                              data-testid={`admin-role-remove-senior-${u.id}`}
                            >
                              Remove Senior Admin
                            </Button>
                          </form>
                        )}

                        {!isSelf && !isSenior && isSeniorAdmin && (
                          <span className="text-xs text-muted-foreground">No actions (Senior Admin)</span>
                        )}

                        {isSelf && <span className="text-xs text-muted-foreground">You</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && users.length === 0 && (
                <TableRow data-testid="admin-roles-empty">
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddRoleDialog({ isSenior, onDone }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const doSearch = async () => {
    try {
      setLoading(true);
      setError("");
      const qs = new URLSearchParams({ q: q || "", scope: "all", limit: "20" });
      const res = await fetch(`/api/admin/users?${qs.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || data?.status !== "success") throw new Error(data?.message || "Search failed");
      setResults(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setError(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} data-testid="admin-roles-dialog">
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="admin-roles-add-trigger">
          Add Role
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="admin-roles-dialog-content">
        <DialogHeader>
          <DialogTitle data-testid="admin-roles-dialog-title">Search users</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email"
              className="flex-1 border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="admin-roles-search-input"
            />
            <Button onClick={doSearch} disabled={loading} data-testid="admin-roles-search-submit">
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
          {error ? (
            <div className="text-sm text-destructive" data-testid="admin-roles-search-error">
              {error}
            </div>
          ) : null}
          <div className="max-h-80 overflow-auto divide-y" data-testid="admin-roles-search-results">
            {results.map((u) => {
              const initials = (u?.name || u?.email || "").trim().slice(0, 2).toUpperCase();
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-2 gap-3"
                  data-testid={`admin-roles-search-row-${u.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar imageUrl={u.image} color={u.color}>
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.role === "admin" ? (
                      <form action={demoteAdminToUser} onSubmit={() => onDone?.()}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`admin-roles-search-remove-admin-${u.id}`}
                        >
                          Remove Admin
                        </Button>
                      </form>
                    ) : u.role === "senior_admin" ? (
                      isSenior ? (
                        <form action={demoteSeniorAdminToAdmin} onSubmit={() => onDone?.()}>
                          <input type="hidden" name="userId" value={u.id} />
                          <Button
                            size="sm"
                            variant="destructive"
                            data-testid={`admin-roles-search-remove-senior-${u.id}`}
                          >
                            Remove Senior Admin
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">Senior Admin</span>
                      )
                    ) : (
                      <>
                        <form action={promoteToAdmin} onSubmit={() => onDone?.()}>
                          <input type="hidden" name="userId" value={u.id} />
                          <Button size="sm" data-testid={`admin-roles-search-make-admin-${u.id}`}>
                            Make Admin
                          </Button>
                        </form>
                        {isSenior && (
                          <form action={promoteToSeniorAdmin} onSubmit={() => onDone?.()}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button
                              size="sm"
                              variant="secondary"
                              data-testid={`admin-roles-search-make-senior-${u.id}`}
                            >
                              Make Senior Admin
                            </Button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {results.length === 0 && !loading && (
              <div
                className="text-sm text-muted-foreground py-6 text-center"
                data-testid="admin-roles-search-empty"
              >
                No results.
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="admin-roles-dialog-close">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
