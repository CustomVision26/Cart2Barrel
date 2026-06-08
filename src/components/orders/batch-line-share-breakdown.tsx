import type { BatchLineShare } from "@/lib/batch-line-share";
import { formatUsd } from "@/lib/admin-markup";

export function BatchLineShareBreakdown({
  share,
  title = "Batch estimate share (this product)",
  className,
}: {
  share: BatchLineShare | null;
  title?: string;
  className?: string;
}) {
  if (!share) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No batch estimate share is available for this product.
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
          <span>Merchandise total</span>
          <span className="text-foreground">{formatUsd(share.merchandise)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Service &amp; handling</span>
          <span className="text-foreground">{formatUsd(share.serviceFee)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Shipping (est.)</span>
          <span className="text-foreground">{formatUsd(share.shipping)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Tax / sale tax</span>
          <span className="text-foreground">{formatUsd(share.tax)}</span>
        </li>
        <li className="flex justify-between gap-2 border-t border-primary/20 pt-2 font-semibold text-foreground">
          <span>Total</span>
          <span>{formatUsd(share.total)}</span>
        </li>
      </ul>
    </div>
  );
}
