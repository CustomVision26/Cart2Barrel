import { AdminBarrelAssignmentsClient } from "@/components/admin/admin-barrel-assignments-client";
import {
  listAdminBarrelAssignments,
  listBarrelOptionsForOwner,
} from "@/data/barrel-package-assignment";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";

export default async function AdminAssignToBarrelPage() {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Assign to barrel
        </h1>
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      </div>
    );
  }

  const rows = await listAdminBarrelAssignments();
  const ownerIds = [...new Set(rows.map((r) => r.ownerClerkUserId))];
  const entries = await Promise.all(
    ownerIds.map(async (id) => {
      const opts = await listBarrelOptionsForOwner(id);
      return [id, opts] as const;
    }),
  );
  const barrelsByOwner = Object.fromEntries(entries);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Assign to barrel
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          View inbound packages currently linked to a customer barrel. Reassign when an item does
          not fit or a barrel is full, or remove the link so the shopper can pick another slot.
        </p>
      </div>
      <AdminBarrelAssignmentsClient rows={rows} barrelsByOwner={barrelsByOwner} />
    </div>
  );
}
