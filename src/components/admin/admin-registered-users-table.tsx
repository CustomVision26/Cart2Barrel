"use client";

import { useMemo, useState } from "react";
import { BanIcon, ShieldOffIcon } from "lucide-react";

import { banUserAction, unbanUserAction } from "@/actions/admin-ban-user";
import { UserAccountKindBadge } from "@/components/admin/user-account-kind-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type { AdminRegisteredUserRow } from "@/data/admin-registered-users";
import { cn } from "@/lib/utils";

function formatCreated(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type ConfirmTarget = {
  row: AdminRegisteredUserRow;
  mode: "ban" | "unban";
};

export function AdminRegisteredUsersTable({
  users,
}: {
  users: AdminRegisteredUserRow[];
}) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bannedOverrides, setBannedOverrides] = useState<Record<string, boolean>>(
    {},
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        u.clerkUserId.toLowerCase().includes(q),
    );
  }, [users, query]);

  function isBanned(row: AdminRegisteredUserRow): boolean {
    return bannedOverrides[row.clerkUserId] ?? row.banned;
  }

  async function runModeration(target: ConfirmTarget) {
    setPendingId(target.row.clerkUserId);
    setError(null);
    setMessage(null);
    try {
      const result =
        target.mode === "ban" ?
          await banUserAction({ targetClerkUserId: target.row.clerkUserId })
        : await unbanUserAction({ targetClerkUserId: target.row.clerkUserId });
      if (result.ok) {
        setBannedOverrides((prev) => ({
          ...prev,
          [target.row.clerkUserId]: target.mode === "ban",
        }));
        setMessage(result.message);
        setConfirm(null);
      } else {
        setError(result.message);
      }
    } finally {
      setPendingId(null);
    }
  }

  if (users.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No registered accounts yet. Profiles are created when users sign in.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="registered-user-search">Search accounts</Label>
        <Input
          id="registered-user-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email, or user id…"
          autoComplete="off"
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {users.length} registered account
          {users.length === 1 ? "" : "s"}
        </p>
      </div>

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

      <FloatingHorizontalScroll className="rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Email</th>
              <th className="px-3 py-2.5 font-medium">Created</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((row) => {
              const banned = isBanned(row);
              const isStaff = row.accountKind === "admin";
              const busy = pendingId === row.clerkUserId;
              return (
                <tr
                  key={row.clerkUserId}
                  className={cn(
                    "bg-card",
                    banned && "bg-destructive/5",
                  )}
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground">
                      {row.displayName}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.email ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {formatCreated(row.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <UserAccountKindBadge kind={row.accountKind} />
                      {banned ? (
                        <span className="inline-flex rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Active
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isStaff ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : banned ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirm({ row, mode: "unban" })}
                      >
                        <ShieldOffIcon className="size-3.5" aria-hidden />
                        {busy ? "Working…" : "Unban"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirm({ row, mode: "ban" })}
                      >
                        <BanIcon className="size-3.5" aria-hidden />
                        {busy ? "Working…" : "Ban"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </FloatingHorizontalScroll>

      <Dialog
        open={confirm != null}
        onOpenChange={(open) => {
          if (!pendingId && !open) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!pendingId}>
          {confirm ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirm.mode === "ban" ?
                    "Suspend this account?"
                  : "Lift suspension?"}
                </DialogTitle>
                <DialogDescription>
                  {confirm.mode === "ban" ?
                    <>
                      <span className="font-medium text-foreground">
                        {confirm.row.displayName}
                      </span>{" "}
                      will be banned in Clerk. All sessions are revoked and they
                      cannot sign in until you unban them.
                    </>
                  : <>
                      <span className="font-medium text-foreground">
                        {confirm.row.displayName}
                      </span>{" "}
                      will be unbanned in Clerk and can sign in again.
                    </>
                  }
                </DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton>
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(pendingId)}
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={confirm.mode === "ban" ? "destructive" : "default"}
                  disabled={Boolean(pendingId)}
                  onClick={() => void runModeration(confirm)}
                >
                  {pendingId ?
                    "Working…"
                  : confirm.mode === "ban" ?
                    "Suspend account"
                  : "Unban account"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
