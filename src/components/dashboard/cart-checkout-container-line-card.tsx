import { Box } from "lucide-react";

import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import type { CartCheckoutContainerSummaryLine } from "@/data/cart";
import { formatUsd } from "@/lib/admin-markup";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

type CartCheckoutContainerLineCardProps = {
  line: CartCheckoutContainerSummaryLine;
  className?: string;
};

export function CartCheckoutContainerLineCard({
  line,
  className,
}: CartCheckoutContainerLineCardProps) {
  const priceRows = [
    {
      label: "Container",
      detail: `${line.quantity} × ${formatUsd(line.unitPriceCents)}`,
      amountCents: line.containerSubtotalCents,
    },
    ...(line.packagingFeeCents > 0 ?
      [
        {
          label: "Packaging fee",
          detail: `${line.quantity} × ${formatUsd(line.packagingPerUnitCents)}`,
          amountCents: line.packagingFeeCents,
        },
      ]
    : []),
    {
      label: "Line total",
      amountCents: line.lineTotalCents,
      emphasis: true,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <Box className="size-3 opacity-70" aria-hidden />
              {containerOfferingKindLabel(line.kind)}
            </span>
            <span className="text-xs text-muted-foreground">{line.sizeSnapshot}</span>
          </div>
          <p className="break-words text-sm font-medium leading-snug text-foreground">
            {line.nameSnapshot}
            {line.quantity > 1 ?
              <span className="ml-1.5 font-normal text-muted-foreground">
                ×{line.quantity}
              </span>
            : null}
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Amount
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatUsd(line.lineTotalCents)}
          </p>
          {line.packagingFeeCents > 0 ?
            <p className="text-[11px] text-muted-foreground">incl. packaging</p>
          : null}
        </div>
      </div>
      <CartLinePriceBreakdown rows={priceRows} className="mt-4" />
    </div>
  );
}
