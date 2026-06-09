import { Package, Receipt } from "lucide-react";

import { CartCheckoutBatchBundleCollapsible } from "@/components/dashboard/cart-checkout-batch-bundle-collapsible";
import { CartCheckoutContainerLineCard } from "@/components/dashboard/cart-checkout-container-line-card";
import { CartCheckoutProductDetail } from "@/components/dashboard/cart-checkout-product-detail";
import { CartLineUrlOrReceipt } from "@/components/dashboard/cart-line-url-or-receipt";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CartCheckoutOrderSummary } from "@/data/cart";
import { formatUsd } from "@/lib/admin-markup";
import { CART_CHECKOUT_USD_DISCLAIMER } from "@/lib/cart-checkout-disclaimer";
import { statusBadgeClassName } from "@/lib/status-badge-kinds";
import { cn } from "@/lib/utils";

export type CartCheckoutStripeLineSummary = {
  description: string;
  quantity: number;
  amountCents: number;
};

type CartCheckoutSummaryCardProps = {
  dbSummary: CartCheckoutOrderSummary | null;
  stripeLines: CartCheckoutStripeLineSummary[];
  /** Prefer order total; else Stripe session `amount_total`. */
  totalCents: number;
  /** From Checkout Session metadata when surcharge applies (shown when listing DB line items). */
  processingFeeCents?: number | null;
  /** e.g. "US cards" / "International cards" — paired with `processingFeeCents`. */
  processingFeeGroupLabel?: string | null;
};

function orderStatusPresentation(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Payment pending",
        className: statusBadgeClassName("awaitingPurchase"),
      };
    case "paid":
      return {
        label: "Paid",
        className: statusBadgeClassName("fullyReceived"),
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        className: statusBadgeClassName("neutral"),
      };
  }
}

export function CartCheckoutSummaryCard({
  dbSummary,
  stripeLines,
  totalCents,
  processingFeeCents,
  processingFeeGroupLabel,
}: CartCheckoutSummaryCardProps) {
  const bundleLineTotal =
    dbSummary?.batchBundles.reduce((n, b) => n + b.lines.length, 0) ?? 0;
  const standaloneCount = dbSummary?.standaloneLines.length ?? 0;
  const containerCount = dbSummary?.containerLines.length ?? 0;
  const dbLineTotal = bundleLineTotal + standaloneCount + containerCount;

  const legacyAggregatePackingStripeLine = (description: string) => {
    const d = description.trim().toLowerCase();
    return d === "barrel packing fee" || d === "bin packing fee";
  };
  const stripeLinesForDisplay = stripeLines.filter(
    (row) => !legacyAggregatePackingStripeLine(row.description),
  );
  const lineCount =
    dbLineTotal > 0 ? dbLineTotal : stripeLinesForDisplay.length;

  return (
    <Card
      className={cn(
        "h-fit overflow-hidden rounded-lg border-border bg-card shadow-sm",
      )}
    >
      <CardHeader className="space-y-4 border-b border-border/60 bg-muted pb-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground">
            <Receipt className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Summary
            </p>
            <CardTitle className="font-heading text-lg font-semibold leading-snug text-foreground">
              Order summary
            </CardTitle>
            <CardDescription className="text-[13px] leading-relaxed text-muted-foreground">
              {dbSummary ?
                <>
                  <span className="text-foreground">Order reference</span>{" "}
                  <span className="font-mono text-xs text-foreground" title={dbSummary.orderId}>
                    {dbSummary.orderId.slice(0, 8)}…
                  </span>
                  <span className="mx-2 text-border">·</span>
                  <span
                    className={cn(
                      "tabular-nums capitalize",
                      orderStatusPresentation(dbSummary.status).className
                    )}
                  >
                    {orderStatusPresentation(dbSummary.status).label}
                  </span>
                </>
              : "Verify that the items below match your selections before proceeding to payment."}
            </CardDescription>
          </div>
        </div>
        {lineCount > 0 ?
          <p className="flex items-center gap-2 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            <Package className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span>
              <span className="font-medium tabular-nums text-foreground">
                {lineCount}
              </span>{" "}
              merchandise {lineCount === 1 ? "line" : "lines"}
            </span>
          </p>
        : null}
      </CardHeader>

      <CardContent className="space-y-0 p-0">
        <div className="px-5 pt-4">
          {dbSummary && dbLineTotal > 0 ?
            <ul className="space-y-6" role="list">
              {dbSummary.batchBundles.map((bundle) => (
                <li key={bundle.batchSessionId}>
                  <CartCheckoutBatchBundleCollapsible bundle={bundle} />
                </li>
              ))}
              {dbSummary.standaloneLines.map((line) => (
                <li key={line.itemRequestId}>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          Merchandise
                        </p>
                        <p className="break-words text-sm font-medium leading-snug text-foreground">
                          {line.productName?.trim() || "Product"}
                          {line.quantity > 1 ?
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              ×{line.quantity}
                            </span>
                          : null}
                        </p>
                        <CartCheckoutProductDetail detail={line.productReferenceDetail} />
                        {line.chargeCaption ?
                          <p className="text-[13px] leading-relaxed text-muted-foreground">
                            {line.chargeCaption}
                          </p>
                        : null}
                        {line.productUrl ?
                          <CartLineUrlOrReceipt
                            lineId={line.itemRequestId}
                            productUrl={line.productUrl}
                            outsidePurchaseReceiptImageUrl={
                              line.outsidePurchaseReceiptImageUrl
                            }
                          />
                        : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch justify-between border-t border-border/50 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-right">
                          Amount
                        </span>
                        <span className="text-base font-semibold tabular-nums text-foreground sm:text-right">
                          {formatUsd(line.lineTotalCents)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {dbSummary.containerLines.map((line) => (
                <li key={line.id}>
                  <CartCheckoutContainerLineCard line={line} />
                </li>
              ))}
            </ul>
          : stripeLinesForDisplay.length > 0 ?
            <ul className="space-y-3" role="list">
              {stripeLinesForDisplay.map((row, idx) => (
                <li key={`${row.description}-${idx}`}>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          Merchandise
                        </p>
                        <p className="break-words text-sm font-medium leading-snug text-foreground">
                          {row.description}
                          {row.quantity > 1 ?
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              ×{row.quantity}
                            </span>
                          : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch justify-between border-t border-border/50 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-right">
                          Amount
                        </span>
                        <span className="text-base font-semibold tabular-nums text-foreground sm:text-right">
                          {formatUsd(row.amountCents)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          : (
            <p className="rounded-lg border border-dashed border-border bg-secondary px-4 py-8 text-center text-[13px] leading-relaxed text-muted-foreground">
              Item descriptions will synchronize from your Stripe session shortly. Totals shown
              below remain authoritative until lines load.
            </p>
          )}
          {dbSummary &&
          dbLineTotal > 0 &&
          processingFeeCents != null &&
          processingFeeCents > 0 ?
            <div className="mt-4 rounded-lg border border-border/60 bg-muted p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Card processing (estimate)
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Estimated pass-through
                    {processingFeeGroupLabel ?
                      <span className="text-foreground">
                        {" "}
                        ({processingFeeGroupLabel})
                      </span>
                    : null}
                    . Listed separately on your card statement where applicable.
                  </p>
                </div>
                <p className="text-base font-semibold tabular-nums text-foreground sm:text-right">
                  {formatUsd(processingFeeCents)}
                </p>
              </div>
            </div>
          : null}
        </div>

        <div className="mt-4 border-t border-border bg-secondary px-5 py-5">
          <div className="flex items-baseline justify-between gap-4 border-b border-border/40 pb-3">
            <span className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Order total (USD)
            </span>
            <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatUsd(totalCents)}
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {CART_CHECKOUT_USD_DISCLAIMER}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
