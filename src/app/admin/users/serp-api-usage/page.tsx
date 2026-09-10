import { AdminSerpApiUsageBarChart } from "@/components/admin/admin-serp-api-usage-bar-chart";
import { AdminSerpApiUsageByUserTable } from "@/components/admin/admin-serp-api-usage-by-user-table";
import { AdminSerpApiUsageMeters } from "@/components/admin/admin-serp-api-usage-meters";
import {
  countSerpApiSearchesSince,
  listSerpApiDailyBuckets,
  listSerpApiHourlyBuckets,
  listSerpApiUsageByUser,
} from "@/data/serp-api-search-events";
import { fetchSerpApiAccountSnapshot } from "@/lib/serpapi/account";

export const dynamic = "force-dynamic";

export default async function AdminUsersSerpApiUsagePage() {
  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setUTCMinutes(0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let account = null;
  let hourly = [] as Awaited<ReturnType<typeof listSerpApiHourlyBuckets>>;
  let daily = [] as Awaited<ReturnType<typeof listSerpApiDailyBuckets>>;
  let byUser = [] as Awaited<ReturnType<typeof listSerpApiUsageByUser>>;
  let appHourCount = 0;
  let appMonthCount = 0;

  try {
    [account, hourly, daily, appHourCount, appMonthCount] = await Promise.all([
      fetchSerpApiAccountSnapshot(),
      listSerpApiHourlyBuckets(24),
      listSerpApiDailyBuckets(30),
      countSerpApiSearchesSince(hourStart.toISOString()),
      countSerpApiSearchesSince(monthStart.toISOString()),
    ]);
  } catch {
    /* Table may not exist until db:ensure-serp-api-usage */
  }

  try {
    byUser = await listSerpApiUsageByUser();
  } catch {
    /* Profiles or usage table may be unavailable */
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Live SerpApi plan meters (searches allowed this month and this hour)
        plus every registered account in All users. Accounts with no lookups
        show zero. Scheduled retailer checks appear as Scheduled /
        unattributed. One product lookup can use several searches. Charts show
        attributed calls after this tracker was added.
      </p>
      <AdminSerpApiUsageMeters
        planName={account?.planName ?? null}
        searchesPerMonth={account?.searchesPerMonth ?? null}
        thisMonthUsage={account?.thisMonthUsage ?? null}
        planSearchesLeft={account?.planSearchesLeft ?? null}
        thisHourSearches={account?.thisHourSearches ?? null}
        lastHourSearches={account?.lastHourSearches ?? null}
        hourlyLimit={account?.hourlyLimit ?? null}
        planRenewalDate={account?.planRenewalDate ?? null}
        appHourCount={appHourCount}
        appMonthCount={appMonthCount}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <AdminSerpApiUsageBarChart
          title="Searches / hour"
          caption="Attributed SerpApi calls in this app over the last 24 hours."
          buckets={hourly}
        />
        <AdminSerpApiUsageBarChart
          title="Searches / month"
          caption="Attributed SerpApi calls in this app over the last 30 days."
          buckets={daily}
        />
      </div>
      <div className="space-y-3">
        <h2 className="font-heading text-base font-medium text-foreground">
          By user
        </h2>
        <AdminSerpApiUsageByUserTable rows={byUser} />
      </div>
    </div>
  );
}
