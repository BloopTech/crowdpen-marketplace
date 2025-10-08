"use client";

import React from "react";
import { useAdmin } from "../context";
import { useSession } from "next-auth/react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { promoteToAdmin, demoteAdminToUser, promoteToSeniorAdmin, demoteSeniorAdminToAdmin } from "./actions";

export default function RolesPage() {
  const { data: session } = useSession();
  const { usersQuery } = useAdmin();

  const isSenior = session?.user?.role === "senior_admin";

  const users = usersQuery?.data?.data || [];
  const loading = usersQuery?.isFetching || usersQuery?.isLoading;
  const error = usersQuery?.error?.message;

  return (
    <div className="px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Roles</CardTitle>
            <Button onClick={() => usersQuery.refetch()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === session?.user?.id;
                const isAdmin = u.role === "admin";
                const isSeniorAdmin = u.role === "senior_admin";

                return (
                  <TableRow key={u.id}>
                    <TableCell>{u.name || "Unnamed"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>{u.crowdpen_staff ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {/* Promote to Admin (if user) */}
                        {!isSelf && u.role === "user" && (
                          <form action={promoteToAdmin}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button size="sm">Make Admin</Button>
                          </form>
                        )}

                        {/* Demote Admin to User (only for admins, not senior_admin) */}
                        {!isSelf && isAdmin && (
                          <form action={demoteAdminToUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button size="sm" variant="outline">Remove Admin</Button>
                          </form>
                        )}

                        {/* Senior admin actions - only visible if current viewer is senior_admin */}
                        {!isSelf && isSenior && !isSeniorAdmin && (
                          <form action={promoteToSeniorAdmin}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button size="sm" variant="secondary">Make Senior Admin</Button>
                          </form>
                        )}

                        {!isSelf && isSenior && isSeniorAdmin && (
                          <form action={demoteSeniorAdminToAdmin}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button size="sm" variant="destructive">Remove Senior Admin</Button>
                          </form>
                        )}

                        {/* Never allow admins to modify senior_admin */}
                        {!isSelf && !isSenior && isSeniorAdmin && (
                          <span className="text-xs text-muted-foreground">No actions (Senior Admin)</span>
                        )}

                        {isSelf && (
                          <span className="text-xs text-muted-foreground">You</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
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
