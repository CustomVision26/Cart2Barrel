import type { ItemQuote } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";

function ChargesGrid({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-md border border-border bg-muted px-3 py-2"
        >
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SingleEstimateRecord({ quote }: { quote: ItemQuote }) {
  const operational = isOperationalQuoteRow(quote);
  const label =
    quote.checkoutSnapshotKind === "paid" ?
      "Checkout price snapshot"
    : quote.checkoutSnapshotKind === "company_purchase" ?
      "Company purchase price snapshot"
    : quote.voidedAt ?
      "Superseded single estimate"
    : "Single estimate";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{label}</p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
            Quote {quote.id}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <time dateTime={quote.createdAt}>
            Created {new Date(quote.createdAt).toLocaleString()}
          </time>
        </p>
      </div>
      <ChargesGrid
        rows={[
          { label: "Item cost", value: formatUsd(quote.itemCost) },
          { label: "Service fee", value: formatUsd(quote.serviceFee) },
          { label: "Estimated shipping", value: formatUsd(quote.estimatedShipping) },
          { label: "Total price", value: formatUsd(quote.totalPrice) },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        {operational ?
          "Operational estimate row."
        : "Timeline snapshot row kept for checkout or purchase history."}
      </p>
    </div>
  );
}

/** Image-4 style list of quote/checkout price snapshots for a single product. */
export function SingleEstimateRecordsList({ quotes }: { quotes: ItemQuote[] }) {
  if (quotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No estimate records for this product yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {quotes.map((quote) => (
        <SingleEstimateRecord key={quote.id} quote={quote} />
      ))}
    </div>
  );
}
