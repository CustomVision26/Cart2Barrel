"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type { AdminRoleGrantLogRow } from "@/data/admin-role-grants";

function formatWhen(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminRoleGrantsLogTable({
  rows,
}: {
  rows: AdminRoleGrantLogRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No admin grants recorded yet. When you assign admin access, entries
        appear here with who granted it and when.
      </p>
    );
  }

  return (
    <FloatingHorizontalScroll className="rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">When</th>
            <th className="px-3 py-2.5 font-medium">New admin</th>
            <th className="px-3 py-2.5 font-medium">Granted by</th>
            <th className="px-3 py-2.5 font-medium">Role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="bg-background/80">
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {formatWhen(row.createdAt)}
              </td>
              <td className="px-3 py-2.5">
                <span className="font-medium text-foreground">
                  {row.targetDisplayName}
                </span>
                {row.targetEmail ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.targetEmail}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 font-medium text-foreground">
                {row.grantedByDisplayName}
              </td>
              <td className="px-3 py-2.5 capitalize text-muted-foreground">
                {row.grantedRole}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </FloatingHorizontalScroll>
  );
}
