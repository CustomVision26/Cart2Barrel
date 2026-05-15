import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FinanceDateRange } from "@/data/admin-finance-summary";
import { getAdminFinanceSummary } from "@/data/admin-finance-summary";
import { formatUsd } from "@/lib/admin-markup";

export async function AdminFinancePanel({ range }: { range: FinanceDateRange }) {
  const s = await getAdminFinanceSummary(range);
  const approxNetCents = s.saleRevenueCents - s.refundsCents - s.stripeFeeCents;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Finance</h2>
        <p className="text-sm text-muted-foreground">
          Compare <span className="font-medium text-foreground">quoted</span> sale tax (from staff
          estimates at checkout) with{" "}
          <span className="font-medium text-foreground">Stripe</span> session tax. Revenue sums
          successful payments for orders created in range; refunds sum by refund time.
        </p>
      </div>

      <form
        method="GET"
        action="/admin"
        className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <input type="hidden" name="tab" value="finance" />
        <div className="space-y-1.5">
          <label htmlFor="finance-from" className="text-xs font-medium text-muted-foreground">
            From (UTC date)
          </label>
          <input
            id="finance-from"
            name="from"
            type="date"
            defaultValue={range.fromIso}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="finance-to" className="text-xs font-medium text-muted-foreground">
            To (UTC date)
          </label>
          <input
            id="finance-to"
            name="to"
            type="date"
            defaultValue={range.toIso}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply range
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        Range: <span className="font-mono text-foreground">{range.fromIso}</span> →{" "}
        <span className="font-mono text-foreground">{range.toIso}</span> · Paid orders in range:{" "}
        <span className="tabular-nums text-foreground">{s.paidOrderCount}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sale revenue</CardTitle>
            <CardDescription>
              Sum of payment amounts for paid orders with order date in range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatUsd(s.saleRevenueCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quoted sale tax (internal)</CardTitle>
            <CardDescription>
              Staff estimate roll-up stored when checkout was created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatUsd(s.internalQuotedSaleTaxCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tax (Stripe session)</CardTitle>
            <CardDescription>
              From Stripe Checkout{" "}
              <span className="font-mono text-[11px]">total_details.amount_tax</span> when captured.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatUsd(s.stripeReportedTaxCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stripe processing fees</CardTitle>
            <CardDescription>
              Balance transaction fee per payment (nulls excluded from sum).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatUsd(s.stripeFeeCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Refunds</CardTitle>
            <CardDescription>
              Sum of line refunds with refund created date in range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatUsd(s.refundsCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Approx. net after fees &amp; refunds</CardTitle>
            <CardDescription>Revenue − refunds − Stripe fees (informational).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatUsd(approxNetCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Orders placed before finance columns were added show $0.00 for Stripe fee and session tax
        until new payments are captured with the updated webhook flow.
      </p>
    </div>
  );
}
