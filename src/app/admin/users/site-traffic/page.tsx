import { AdminSiteTrafficPanel } from "@/components/admin/admin-site-traffic-panel";
import { listSiteTrafficSnapshot } from "@/data/page-visits";
import {
  parseSiteTrafficPeriod,
  siteTrafficPeriodRangeLabel,
} from "@/lib/site-traffic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminUsersSiteTrafficPage({
  searchParams,
}: PageProps) {
  const rawSp = (await searchParams) ?? {};
  const period = parseSiteTrafficPeriod(rawSp.period);
  const snapshot = await listSiteTrafficSnapshot(period);
  const range = siteTrafficPeriodRangeLabel(period);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        First-party page views for {range}. Sort by day, week, month, or year.
        Registered rows are signed-in Clerk accounts; unregistered rows are
        anonymous browsers identified by a cookie. Admin screens are not
        recorded. Expand a visitor to see the pages they opened.
      </p>
      <AdminSiteTrafficPanel snapshot={snapshot} />
    </div>
  );
}
