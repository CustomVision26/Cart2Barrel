import { AdminFinancePanel } from "./_components/admin-finance-panel";
import { AdminOverviewSubnav } from "./_components/admin-overview-subnav";
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

export default async function AdminHomePage({ searchParams }: PageProps) {
  const rawSp = (await searchParams) ?? {};
  const tab =
    first(rawSp.tab)?.toLowerCase() === "finance" ? "finance" : "summary";
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
      ) : (
        <div className="space-y-4">
          <AdminRefundQueueBanner />
          <p className="text-sm text-muted-foreground">
            Use the <span className="font-medium text-foreground">Finance</span> tab for revenue,
            taxes, Stripe fees, and refunds by date range.
          </p>
        </div>
      )}
    </div>
  );
}
