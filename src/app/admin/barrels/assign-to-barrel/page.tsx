import { AdminBarrelAssignmentsClient } from "@/components/admin/admin-barrel-assignments-client";
import {
  listAdminBarrelPipelineLines,
  listBarrelOptionsForOwner,
} from "@/data/barrel-package-assignment";
import { parseAdminCustomerFilter } from "@/lib/admin-customer-filter";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAssignToBarrelPage({ searchParams }: PageProps) {
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

  const { clerkUserId: filterClerkUserId } = parseAdminCustomerFilter(
    (await searchParams) ?? {},
  );
  const allRows = await listAdminBarrelPipelineLines();
  const rows =
    filterClerkUserId ?
      allRows.filter((r) => r.ownerClerkUserId === filterClerkUserId)
    : allRows;
  const ownerIds = [...new Set(rows.map((r) => r.ownerClerkUserId))];
  const entries = await Promise.all(
    ownerIds.map(async (id) => {
      const opts = await listBarrelOptionsForOwner(id);
      return [
        id,
        opts.map((o) => ({ ...o, ownerClerkUserId: id })),
      ] as const;
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
          Assign inbound products to customer containers, reassign when an item does not fit, mark
          containers full, or remove assignments. Both awaiting and already-assigned products
          appear below. Shoppers see read-only status on their Product to barrel page; every
          change is recorded in history.
        </p>
      </div>
      <AdminBarrelAssignmentsClient rows={rows} barrelsByOwner={barrelsByOwner} />
    </div>
  );
}
