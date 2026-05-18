import { AdminItemRequestsTabNav } from "@/components/admin/admin-item-requests-tab-nav";
import { loadAdminItemRequestsNavState } from "@/data/admin-item-requests-page-payload";

export default async function AdminItemRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await loadAdminItemRequestsNavState();

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Item requests
        </h1>
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-foreground">
          {result.message}
        </p>
      </div>
    );
  }

  const { nav } = result;
  const { emptyAsNonAdmin, noData } = nav;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Item requests
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Active requests</span>{" "}
          has a <span className="font-medium text-foreground">Queue</span> sub-tab grouping each
          account’s in-flight work—new submissions, customer resends (request new estimate),
          and quoted lines awaiting acceptance—and a{" "}
          <span className="font-medium text-foreground">Quote history</span> sub-tab for staff
          single-line estimate revisions (voided quotes from customer resends stay off that list).{" "}
          <span className="font-medium text-foreground">Batch Items</span> separates submitted
          bundles from archived <span className="font-medium text-foreground">batch estimates</span>{" "}
          (sub-tabs).
        </p>
      </div>

      {noData ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyAsNonAdmin
            ? "You do not have admin access."
            : "No item requests or quotes yet."}
        </p>
      ) : (
        <>
          <AdminItemRequestsTabNav pendingBatchCount={nav.pendingBatchCount} />
          <div role="tabpanel" aria-live="polite">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
