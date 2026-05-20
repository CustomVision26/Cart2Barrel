import Link from "next/link";
import { Receipt, ShoppingBag } from "lucide-react";

import { CartCheckoutButton } from "@/components/dashboard/cart-checkout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import type { ContainerPackingFeeBreakdown } from "@/lib/container-packing-fee";
import { CART_CHECKOUT_USD_DISCLAIMER } from "@/lib/cart-checkout-disclaimer";
import { cn } from "@/lib/utils";

type CartOrderSummaryPanelProps = {
  lineCount: number;
  merchandiseSubtotalCents: number;
  estimatedTotalCents: number;
  quotedAndContainerSubtotalCents: number;
  containerPacking: ContainerPackingFeeBreakdown;
  outboundShippingSubtotalCents?: number;
  processingPreviewCents: number;
  processingRegionLabel: string;
  shipCountry: string | null;
  surchargesDisabled: boolean;
  checkoutEnabled: boolean;
};

export function CartOrderSummaryPanel({
  lineCount,
  merchandiseSubtotalCents,
  estimatedTotalCents,
  quotedAndContainerSubtotalCents,
  containerPacking,
  outboundShippingSubtotalCents = 0,
  processingPreviewCents,
  processingRegionLabel,
  shipCountry,
  surchargesDisabled,
  checkoutEnabled,
}: CartOrderSummaryPanelProps) {
  const showBreakdown =
    processingPreviewCents > 0 ||
    containerPacking.totalPackingFeeCents > 0 ||
    containerPacking.barrelCount > 0 ||
    containerPacking.binCount > 0 ||
    outboundShippingSubtotalCents > 0;

  return (
    <Card className="overflow-hidden rounded-xl border-border/80 shadow-lg ring-1 ring-border/40 lg:sticky lg:top-6">
      <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 pb-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background text-primary shadow-sm">
            <Receipt className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Checkout
            </p>
            <CardTitle className="font-heading text-xl font-semibold tracking-tight">
              Order summary
            </CardTitle>
            <CardDescription className="text-[13px] leading-relaxed">
              Review totals before secure payment.
            </CardDescription>
          </div>
        </div>
        <p className="flex items-center gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          <ShoppingBag className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span>
            <span className="font-semibold tabular-nums text-foreground">{lineCount}</span>{" "}
            {lineCount === 1 ? "line" : "lines"} in cart
          </span>
        </p>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {showBreakdown ?
          <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/10 px-3.5 py-3 text-sm">
            <SummaryRow
              label="Subtotal (items & containers)"
              valueCents={quotedAndContainerSubtotalCents}
            />
            {containerPacking.barrelPackingFeeCents > 0 ?
              <SummaryRow
                label={`Barrel packaging (${containerPacking.barrelCount})`}
                valueCents={containerPacking.barrelPackingFeeCents}
                muted
              />
            : null}
            {containerPacking.binPackingFeeCents > 0 ?
              <SummaryRow
                label={`Bin packaging (${containerPacking.binCount})`}
                valueCents={containerPacking.binPackingFeeCents}
                muted
              />
            : null}
            {outboundShippingSubtotalCents > 0 ?
              <SummaryRow
                label="Outbound container shipping"
                valueCents={outboundShippingSubtotalCents}
                muted
              />
            : null}
            {processingPreviewCents > 0 ?
              <SummaryRow
                label={`Card processing · ${processingRegionLabel}`}
                valueCents={processingPreviewCents}
                muted
              />
            : null}
          </div>
        : null}

        <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-4 shadow-inner">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {processingPreviewCents > 0 ? "Estimated total" : "Total"}
            </span>
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatUsd(
                processingPreviewCents > 0 ?
                  estimatedTotalCents
                : merchandiseSubtotalCents,
              )}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">All amounts in USD</p>
        </div>

        <div className="space-y-3">
          <CartCheckoutButton checkoutEnabled={checkoutEnabled} className="w-full" size="lg" />
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {processingPreviewCents > 0 ?
              <>
                Processing preview uses your{" "}
                <Link
                  href="/dashboard/shipping/address"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  shipping address
                </Link>
                {shipCountry ? <> ({shipCountry})</> : null}. Final amount is confirmed at
                checkout.
              </>
            : surchargesDisabled ?
              <>Checkout total should match this subtotal.</>
            : <>Secure checkout powered by Stripe.</>}
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground/90">
            {CART_CHECKOUT_USD_DISCLAIMER}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  valueCents,
  muted,
}: {
  label: string;
  valueCents: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={cn("min-w-0", muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span className="shrink-0 font-medium tabular-nums text-foreground">
        {formatUsd(valueCents)}
      </span>
    </div>
  );
}
