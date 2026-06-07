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

function SingleEstimateRecord({
  quote,
  batchCheckout,
}: {
  quote: ItemQuote;
  batchCheckout?: boolean;
}) {
  const operational = isOperationalQuoteRow(quote);
  const label =
    quote.voidedAt ? "Superseded single estimate" : "Single estimate";

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
      {operational && batchCheckout ?
        <p className="text-xs text-muted-foreground">
          This is the standalone single-product estimate breakdown, not the batch
          bundle checkout breakdown. Open Batch Estimate for your line share of the batch
          estimate.
        </p>
      : operational ?
        <p className="text-xs text-muted-foreground">Operational estimate row.</p>
      : null}
    </div>
  );
}

/** Operational single-product quote rows (checkout timeline snapshots excluded). */
export function filterSingleEstimateDisplayQuotes(quotes: ItemQuote[]): ItemQuote[] {
  return quotes.filter(isOperationalQuoteRow);
}

/** List of operational single-product estimates for one line. */
export function SingleEstimateRecordsList({
  quotes,
  batchCheckout = false,
}: {
  quotes: ItemQuote[];
  batchCheckout?: boolean;
}) {
  const displayQuotes = filterSingleEstimateDisplayQuotes(quotes);

  if (displayQuotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No estimate records for this product yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {displayQuotes.map((quote) => (
        <SingleEstimateRecord
          key={quote.id}
          quote={quote}
          batchCheckout={batchCheckout}
        />
      ))}
    </div>
  );
}
