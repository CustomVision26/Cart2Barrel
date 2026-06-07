import type { ItemQuote } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";

export function SingleQuoteBreakdown({
  quote,
  title = "Single product estimate",
  className,
}: {
  quote: ItemQuote | null;
  title?: string;
  className?: string;
}) {
  if (!quote) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No saved line quote — single-product totals not available.
      </p>
    );
  }
  return (
    <div className={className ?? "rounded-lg border border-primary/25 bg-primary/5 p-3"}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm tabular-nums text-muted-foreground">
        <li className="flex justify-between gap-2">
          <span>Merchandise</span>
          <span className="text-foreground">{formatUsd(quote.itemCost)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Service &amp; handling</span>
          <span className="text-foreground">{formatUsd(quote.serviceFee)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Shipping (est.)</span>
          <span className="text-foreground">{formatUsd(quote.estimatedShipping)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Tax / sale tax</span>
          <span className="text-foreground">
            {formatUsd(lineSaleTaxCentsFromQuote(quote))}
          </span>
        </li>
        <li className="flex justify-between gap-2 border-t border-primary/20 pt-2 font-semibold text-foreground">
          <span>Total</span>
          <span>{formatUsd(quote.totalPrice)}</span>
        </li>
      </ul>
    </div>
  );
}
