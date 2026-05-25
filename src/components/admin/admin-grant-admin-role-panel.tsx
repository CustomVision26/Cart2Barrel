"use client";

import { useMemo, useState } from "react";

import { grantAdminRoleAction } from "@/actions/admin-grant-admin-role";
import { UserAccountKindBadge } from "@/components/admin/user-account-kind-badge";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AdminGrantAdminRolePanelProps = {
  users: AdminProfilePickerRow[];
};

export function AdminGrantAdminRolePanel({ users }: AdminGrantAdminRolePanelProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Clerk ids promoted this session (until a full navigation refresh). */
  const [grantedIds, setGrantedIds] = useState<string[]>([]);

  const effectiveKind = (u: AdminProfilePickerRow): AdminProfilePickerRow["accountKind"] =>
    grantedIds.includes(u.clerkUserId) || u.accountKind === "admin" ?
      "admin"
    : "customer";

  const eligibleUsers = useMemo(
    () =>
      users.filter(
        (u) => !grantedIds.includes(u.clerkUserId) && u.accountKind !== "admin",
      ),
    [users, grantedIds],
  );

  const adminCount = users.length - eligibleUsers.length;

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool =
      q ?
        users.filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            (u.email?.toLowerCase().includes(q) ?? false) ||
            u.clerkUserId.toLowerCase().includes(q),
        )
      : users;
    return pool.slice(0, 80);
  }, [users, query]);

  const selectedUser = users.find(
    (u) => u.clerkUserId === selectedId && effectiveKind(u) === "customer",
  );

  async function handleGrant() {
    if (!selectedId) {
      setError("Select a user from the list.");
      setMessage(null);
      return;
    }
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const grantedUserId = selectedId;
      const result = await grantAdminRoleAction({
        targetClerkUserId: grantedUserId,
      });
      if (result.ok) {
        setGrantedIds((prev) =>
          prev.includes(grantedUserId) ? prev : [...prev, grantedUserId],
        );
        setMessage(result.message);
        setSelectedId(null);
        setQuery("");
      } else {
        setError(result.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign admin role</CardTitle>
        <CardDescription>
          Choose a customer account to grant Clerk admin access. The change is
          recorded in the grant log with your name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-user-search">Search users</Label>
          <Input
            id="admin-user-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, or user id…"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {eligibleUsers.length} customer
            {eligibleUsers.length === 1 ? "" : "s"} eligible · {adminCount}{" "}
            already admin
          </p>
        </div>

        <div
          className="max-h-72 overflow-y-auto rounded-lg border border-border"
          role="listbox"
          aria-label="All users"
        >
          {filteredUsers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matching users. Try another search or check that they have signed
              in at least once.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredUsers.map((u) => {
                const kind = effectiveKind(u);
                const isAdmin = kind === "admin";
                const selected = selectedId === u.clerkUserId && !isAdmin;
                return (
                  <li key={u.clerkUserId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={isAdmin}
                      disabled={isAdmin}
                      onClick={() => {
                        if (!isAdmin) setSelectedId(u.clerkUserId);
                      }}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        isAdmin
                          ? "cursor-not-allowed opacity-70"
                          : "hover:bg-accent",
                        selected && "bg-primary/10",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">
                          {u.displayName}
                        </span>
                        {u.email ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {u.email}
                          </span>
                        ) : null}
                      </span>
                      <UserAccountKindBadge kind={kind} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedUser ? (
          <p className="text-sm text-muted-foreground">
            Selected:{" "}
            <span className="font-medium text-foreground">
              {selectedUser.displayName}
            </span>
            {selectedUser.email ? ` · ${selectedUser.email}` : null}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}

        <Button
          type="button"
          disabled={pending || !selectedId}
          onClick={handleGrant}
        >
          {pending ? "Granting…" : "Grant admin access"}
        </Button>
      </CardContent>
    </Card>
  );
}
