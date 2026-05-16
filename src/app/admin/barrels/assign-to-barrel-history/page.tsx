import { listBarrelAssignmentHistoryAdmin } from "@/data/barrel-package-assignment";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function actionLabel(
  action: "assigned" | "reassigned" | "removed",
): string {
  switch (action) {
    case "assigned":
      return "Assigned";
    case "reassigned":
      return "Reassigned";
    case "removed":
      return "Removed";
    default: {
      const _e: never = action;
      return _e;
    }
  }
}

export default async function AdminAssignToBarrelHistoryPage() {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Assign to barrel history
        </h1>
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      </div>
    );
  }

  const rows = await listBarrelAssignmentHistoryAdmin(600);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Assign to barrel history
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Cross-customer audit log for barrel moves: timestamp, product snapshot, barrel label
          snapshot, and optional staff notes.
        </p>
      </div>

      {rows.length === 0 ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No assignment events recorded yet.
        </p>
      : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Barrel / movement</th>
                <th className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/80 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatWhen(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">{actionLabel(r.action)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {r.ownerClerkUserId.slice(0, 12)}…
                  </td>
                  <td className="px-3 py-2">
                    {r.productNameSnapshot?.trim() || "—"}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    {r.barrelLabelSnapshot?.trim() || "—"}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    {r.adminNote?.trim() || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
