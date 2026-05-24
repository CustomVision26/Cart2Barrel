import { AdminBarrelAssignmentHistoryTable } from "@/components/admin/admin-barrel-assignment-history-table";
import { AdminPageTitleWithHelp } from "@/components/admin/admin-page-title-with-help";
import { loadAdminCustomerProfilesByClerkUserIds } from "@/data/admin-customer-profiles";
import { listBarrelAssignmentHistoryAdmin } from "@/data/barrel-package-assignment";
import { parseAdminCustomerFilter } from "@/lib/admin-customer-filter";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAssignToBarrelHistoryPage({
  searchParams,
}: PageProps) {
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

  const { clerkUserId: filterClerkUserId } = parseAdminCustomerFilter(
    (await searchParams) ?? {},
  );
  const allRows = await listBarrelAssignmentHistoryAdmin(600);
  const rows =
    filterClerkUserId ?
      allRows.filter((r) => r.ownerClerkUserId === filterClerkUserId)
    : allRows;

  const profileClerkIds = [
    ...new Set([
      ...allRows.map((r) => r.ownerClerkUserId),
      ...allRows.map((r) => r.actorClerkUserId),
    ]),
  ];
  const profilesByClerkUserId =
    await loadAdminCustomerProfilesByClerkUserIds(profileClerkIds);

  return (
    <div className="space-y-6">
      <AdminPageTitleWithHelp
        title="Assign to barrel history"
        tooltipClassName="w-80"
        help={
          <>
            Cross-customer audit log for barrel moves: timestamp, product snapshot,
            barrel label snapshot, admin who made the change (Updated by column), and
            optional staff notes.
          </>
        }
      />

      <AdminBarrelAssignmentHistoryTable
        rows={rows}
        profilesByClerkUserId={profilesByClerkUserId}
      />
    </div>
  );
}
