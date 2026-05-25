"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { CartLineUrlOrReceipt } from "@/components/dashboard/cart-line-url-or-receipt";
import { Button } from "@/components/ui/button";
import type { CartCheckoutBatchBundleSummary } from "@/data/cart";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

type CartCheckoutBatchBundleCollapsibleProps = {
  bundle: CartCheckoutBatchBundleSummary;
};

export function CartCheckoutBatchBundleCollapsible({
  bundle,
}: CartCheckoutBatchBundleCollapsibleProps) {
  const [linesOpen, setLinesOpen] = useState(true);
  const reactId = useId();
  const toggleId = `checkout-batch-toggle-${bundle.batchSessionId}-${reactId}`;
  const regionId = `checkout-batch-lines-${bundle.batchSessionId}-${reactId}`;
  const n = bundle.lines.length;

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted p-4")}>
      <div className="flex flex-col gap-3 border-b border-border/40 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            id={toggleId}
            aria-expanded={linesOpen}
            aria-controls={regionId}
            aria-label={
              linesOpen ? "Hide batch line items" : "Show batch line items"
            }
            onClick={() => setLinesOpen((o) => !o)}
            className={cn(
              "h-9 shrink-0 gap-2 border-border/70 bg-card px-2.5 text-muted-foreground",
              "hover:border-border hover:bg-accent hover:text-foreground"
            )}
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                linesOpen && "rotate-180"
              )}
              aria-hidden
            />
            <span className="text-xs font-medium">
              {linesOpen ? "Hide items" : "Show items"}
            </span>
          </Button>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Consolidated bundle
            </p>
            <p className="font-mono text-base font-semibold tracking-tight text-foreground">
              Batch {bundle.batchNumber}
            </p>
            <p className="text-xs text-muted-foreground">{bundle.siteKey}</p>
            <p className="text-xs text-muted-foreground">
              {n} {n === 1 ? "line" : "lines"} · consolidated subtotal (estimate)
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch rounded-lg border border-border/60 bg-card px-3 py-2 sm:items-end sm:text-right">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Subtotal
          </span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {formatUsd(bundle.bundleTotalCents)}
          </span>
        </div>
      </div>
      <div
        id={regionId}
        role="region"
        aria-labelledby={toggleId}
        hidden={!linesOpen}
        className={cn(linesOpen && "mt-4")}
      >
        {linesOpen ?
          <ul className="space-y-2" role="list">
            {bundle.lines.map((line) => (
              <li
                key={line.itemRequestId}
                className="rounded-lg border border-border/50 bg-card px-3 py-2.5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words text-sm font-medium leading-snug text-foreground">
                      {line.productName?.trim() || "Product"}
                      {line.quantity > 1 ?
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          ×{line.quantity}
                        </span>
                      : null}
                    </p>
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
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Line allocation
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatUsd(line.lineTotalCents)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        : null}
      </div>
    </div>
  );
}
