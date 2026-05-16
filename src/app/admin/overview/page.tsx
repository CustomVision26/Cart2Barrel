import { AdminFinancePanel } from "../_components/admin-finance-panel";
import { AdminOverviewSetFeeNRateSection } from "../_components/admin-overview-set-fee-n-rate-section";
import { AdminOverviewShippingContainersSection } from "../_components/admin-overview-shipping-containers-section";
import { AdminOverviewSubnav } from "../_components/admin-overview-subnav";
import { AdminRefundQueueBanner } from "@/components/admin/admin-refund-queue-banner";
import { parseFinanceDateRange } from "@/data/admin-finance-summary";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(
  param: string | string[] | undefined,
): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const rawSp = (await searchParams) ?? {};
  const tabRaw = first(rawSp.tab)?.toLowerCase() ?? "";
  const tab =
    tabRaw === "finance" ? "finance"
    : tabRaw === "set-fee-n-rate" ? "set-fee-n-rate"
    : tabRaw === "shipping-containers" ? "shipping-containers"
    : "summary";
  const range = parseFinanceDateRange({
    from: first(rawSp.from)?.trim(),
    to: first(rawSp.to)?.trim(),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Admin overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Staff tools for quotes, orders, warehouse, and shipping.
          </p>
        </div>
        <AdminOverviewSubnav active={tab} />
      </div>

      {tab === "finance" ? (
        <AdminFinancePanel range={range} />
      ) : tab === "set-fee-n-rate" ? (
        <AdminOverviewSetFeeNRateSection />
      ) : tab === "shipping-containers" ? (
        <AdminOverviewShippingContainersSection />
      ) : (
        <div className="space-y-4">
          <AdminRefundQueueBanner />
          <p className="text-sm text-muted-foreground">
            Use the <span className="font-medium text-foreground">Finance</span> tab for revenue,
            taxes, Stripe fees, and refunds by date range. Use{" "}
            <span className="font-medium text-foreground">Fees &amp; rates</span> for packing and
            service &amp; handling tiers, and{" "}
            <span className="font-medium text-foreground">Shipping containers</span> for the barrel
            catalog on <span className="font-medium text-foreground">/dashboard/barrels</span>.
          </p>
        </div>
      )}
    </div>
  );
}
