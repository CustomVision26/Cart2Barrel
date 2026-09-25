import { AdminSiteTrafficPanel } from "@/components/admin/admin-site-traffic-panel";
import { listSiteTrafficSnapshot } from "@/data/page-visits";

export const dynamic = "force-dynamic";

export default async function AdminUsersSiteTrafficPage() {
  const snapshot = await listSiteTrafficSnapshot();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        First-party page views for the last 30 days. Registered rows are
        signed-in Clerk accounts; unregistered rows are anonymous browsers
        identified by a cookie. Admin screens are not recorded. Expand a
        visitor to see the pages they opened.
      </p>
      <AdminSiteTrafficPanel snapshot={snapshot} />
    </div>
  );
}
