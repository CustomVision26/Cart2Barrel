"use client";

import { CreditCard, EyeIcon, Loader2Icon } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

import {
  getDashboardCheckoutChargePreviewAction,
  type DashboardCheckoutChargePreviewInput,
} from "@/actions/dashboard-checkout-charge-preview";
import { CartCheckoutHubStockPackageCard } from "@/components/dashboard/cart-checkout-hub-stock-package-card";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import { MerchandiseTopupAmountBreakdownToggle } from "@/components/merchandise-topup-amount-breakdown-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/admin-markup";
import type { CheckoutChargesPreview } from "@/data/dashboard-checkout-charge-preview";
import type { MerchandiseTopupChargeBreakdown } from "@/data/merchandise-topup-cart";
import {
  reconciliationChargeTotalCents,
  type ReconciliationChargeBreakdown,
} from "@/lib/merchandise-reconciliation";
import { cn } from "@/lib/utils";

function toChargeSides(breakdown: MerchandiseTopupChargeBreakdown): {
  checkout: ReconciliationChargeBreakdown;
  actual: ReconciliationChargeBreakdown;
} {
  return {
    checkout: {
      merchandiseCents: breakdown.checkoutMerchandiseCents,
      shippingCents: breakdown.checkoutShippingCents,
      taxCents: breakdown.checkoutTaxCents,
      serviceCents: breakdown.checkoutServiceCents,
    },
    actual: {
      merchandiseCents: breakdown.actualMerchandiseCents,
      shippingCents: breakdown.actualShippingCents,
      taxCents: breakdown.actualTaxCents,
      serviceCents: breakdown.actualServiceCents,
    },
  };
}

function sumPaidTopupBreakdowns(
  breakdowns: MerchandiseTopupChargeBreakdown[],
): MerchandiseTopupChargeBreakdown | null {
  if (breakdowns.length === 0) return null;
  return breakdowns.reduce(
    (acc, b) => ({
      checkoutMerchandiseCents:
        acc.checkoutMerchandiseCents + b.checkoutMerchandiseCents,
      checkoutShippingCents: acc.checkoutShippingCents + b.checkoutShippingCents,
      checkoutTaxCents: acc.checkoutTaxCents + b.checkoutTaxCents,
      checkoutServiceCents: acc.checkoutServiceCents + b.checkoutServiceCents,
      actualMerchandiseCents:
        acc.actualMerchandiseCents + b.actualMerchandiseCents,
      actualShippingCents: acc.actualShippingCents + b.actualShippingCents,
      actualTaxCents: acc.actualTaxCents + b.actualTaxCents,
      actualServiceCents: acc.actualServiceCents + b.actualServiceCents,
      deltaCents: acc.deltaCents + b.deltaCents,
    }),
    {
      checkoutMerchandiseCents: 0,
      checkoutShippingCents: 0,
      checkoutTaxCents: 0,
      checkoutServiceCents: 0,
      actualMerchandiseCents: 0,
      actualShippingCents: 0,
      actualTaxCents: 0,
      actualServiceCents: 0,
      deltaCents: 0,
    },
  );
}

type DashboardCheckoutChargesPreviewDialogProps =
  DashboardCheckoutChargePreviewInput & {
    triggerLabel?: string;
    triggerClassName?: string;
  };

function resolveCheckoutSubtotalCents(preview: CheckoutChargesPreview): number {
  if (preview.productSummary) {
    return preview.productSummary.linePriceCents;
  }
  const emphasized = [...preview.summaryRows]
    .reverse()
    .find((row) => row.emphasis);
  if (emphasized) return emphasized.amountCents;
  if (preview.productLines.length > 0) {
    return preview.productLines.reduce((sum, line) => sum + line.amountCents, 0);
  }
  return 0;
}

function shortOrderId(orderId: string): string {
  return `${orderId.slice(0, 8)}…`;
}

export function DashboardCheckoutChargesPreviewDialog({
  triggerLabel = "Preview checkout charges",
  triggerClassName,
  ...input
}: DashboardCheckoutChargesPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CheckoutChargesPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadPreview = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await getDashboardCheckoutChargePreviewAction(input);
      if (!res.ok) {
        setPreview(null);
        setError(res.message);
        return;
      }
      setPreview(res.preview);
    });
  }, [
    input.scope,
    input.orderId,
    "batchSessionId" in input ? input.batchSessionId : "",
    "orderItemId" in input ? input.orderItemId : "",
  ]);

  const paidTopups = preview?.paidTopupAddOns ?? [];
  const checkoutSubtotalCents = preview ? resolveCheckoutSubtotalCents(preview) : 0;
  const addOnTotalCents = paidTopups.reduce(
    (sum, addOn) => sum + addOn.amountCents,
    0,
  );
  const adjustedTotalCents = checkoutSubtotalCents + addOnTotalCents;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          loadPreview();
        } else {
          setPreview(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        type="button"
        className={
          triggerClassName ??
          "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
      >
        <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{preview?.title ?? "Checkout charges"}</DialogTitle>
          <DialogDescription>
            {preview?.description ??
              "Summary of what was charged when you completed checkout."}
          </DialogDescription>
        </DialogHeader>

        {pending ?
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Loading checkout summary…
          </div>
        : error ?
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
            {error}
          </p>
        : preview ?
          <div className="space-y-4">
            {preview.productSummary ?
              <dl className="grid gap-3 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Product
                  </dt>
                  <dd className="font-medium leading-snug text-foreground">
                    {preview.productSummary.productName}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Retailer
                  </dt>
                  <dd className="text-foreground">
                    {preview.productSummary.retailerLabel}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Link
                  </dt>
                  <dd>
                    <a
                      href={preview.productSummary.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Product URL
                    </a>
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Quantity
                  </dt>
                  <dd className="tabular-nums text-foreground">
                    {preview.productSummary.quantity}
                  </dd>
                </div>
                {preview.productSummary.sizeLabel ?
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Size
                    </dt>
                    <dd className="text-foreground">
                      {preview.productSummary.sizeLabel}
                    </dd>
                  </div>
                : null}
                {preview.productSummary.colorLabel ?
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Color
                    </dt>
                    <dd className="text-foreground">
                      {preview.productSummary.colorLabel}
                    </dd>
                  </div>
                : null}
                {!preview.productSummary.sizeLabel &&
                !preview.productSummary.colorLabel ?
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Variant
                    </dt>
                    <dd className="text-foreground">Single</dd>
                  </div>
                : null}
                {preview.productSummary.quotedMerchandiseCostCents != null ?
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Quoted merchandise cost (staff estimate)
                    </dt>
                    <dd className="tabular-nums font-medium text-foreground">
                      {formatUsd(
                        preview.productSummary.quotedMerchandiseCostCents,
                      )}
                    </dd>
                  </div>
                : null}
                <div className="flex flex-col gap-0.5 border-t border-border/70 pt-3">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Checkout line total
                  </dt>
                  <dd className="text-base font-semibold tabular-nums text-foreground">
                    {formatUsd(preview.productSummary.linePriceCents)}
                  </dd>
                </div>
              </dl>
            : null}

            {preview.productSummary || input.scope === "batch" ?
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Charge breakdown
                </p>
                <CartLinePriceBreakdown rows={preview.summaryRows} />
              </div>
            : null}

            {!preview.productSummary && (preview.hubStockPackages?.length ?? 0) > 0 ?
              <ul className="space-y-3" role="list">
                {preview.hubStockPackages?.map((pkg) => (
                  <li key={pkg.key}>
                    <CartCheckoutHubStockPackageCard pkg={pkg} compact />
                  </li>
                ))}
              </ul>
            : null}

            {!preview.productSummary && preview.productLines.length > 0 ?
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {(preview.hubStockPackages?.length ?? 0) > 0 ?
                    "Other products"
                  : "Products on this receipt"}
                </p>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-muted/25" role="list">
                  {preview.productLines.map((line, i) => (
                    <li
                      key={`${line.name}-${i}`}
                      className="px-3.5 py-2.5"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">
                            {line.name}
                          </span>
                          {line.detail ?
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {line.detail}
                            </span>
                          : null}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {formatUsd(line.amountCents)}
                        </span>
                      </div>
                      {line.summaryRows && line.summaryRows.length > 0 ?
                        <div className="mt-2.5">
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Batch summary (this product)
                          </p>
                          <CartLinePriceBreakdown rows={line.summaryRows} />
                        </div>
                      : null}
                    </li>
                  ))}
                </ul>
              </div>
            : null}

            {input.scope === "order" && !preview.productSummary ?
              (() => {
                const extraFeeRows = preview.summaryRows.filter(
                  (row) => !row.emphasis,
                );
                if (extraFeeRows.length === 0) return null;
                return (
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Other checkout charges
                    </p>
                    <CartLinePriceBreakdown rows={extraFeeRows} />
                  </div>
                );
              })()
            : null}

            {paidTopups.length > 0 ?
              <div className="space-y-3 border-t border-border/60 pt-5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md border border-border/70 bg-muted text-primary">
                    <CreditCard className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Extra add-on charges
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Purchase-price top-ups paid after the original checkout.
                    </p>
                  </div>
                </div>

                <ul className="space-y-2.5" role="list">
                  {paidTopups.map((addOn) => {
                    const sides = toChargeSides(addOn.breakdown);
                    const lineCheckoutSubtotal = reconciliationChargeTotalCents(
                      sides.checkout,
                    );
                    return (
                      <li
                        key={addOn.reconciliationId}
                        className="rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm ring-1 ring-border/30"
                      >
                        <div className="space-y-2">
                          <MerchandiseTopupAmountBreakdownToggle
                            label={
                              <span className="text-sm font-semibold leading-snug text-foreground">
                                {addOn.productName}
                              </span>
                            }
                            amountCents={addOn.amountCents}
                            mode="paid"
                            priorPaidInstallmentCents={
                              addOn.priorPaidInstallmentCents
                            }
                            firstInstallmentBreakdownMode="due"
                            checkoutSubtotalCents={lineCheckoutSubtotal}
                            newTotalCents={
                              lineCheckoutSubtotal + addOn.amountCents
                            }
                            checkout={sides.checkout}
                            actual={sides.actual}
                            amountClassName="text-base font-semibold text-foreground"
                            footnote="Expand Previous top-up for amount-due math; This for the latest payment."
                          />
                          <dl className="grid gap-1 rounded-lg border border-border/60 bg-muted/35 px-2.5 py-2 text-xs sm:grid-cols-2">
                            <div className="flex flex-wrap items-baseline gap-x-1.5">
                              <dt className="text-muted-foreground">Top-up #</dt>
                              <dd className="font-mono font-medium tabular-nums text-foreground">
                                {addOn.topupNumber}
                              </dd>
                            </div>
                            {addOn.batchNumber ?
                              <div className="flex flex-wrap items-baseline gap-x-1.5">
                                <dt className="text-muted-foreground">Batch #</dt>
                                <dd className="font-mono font-medium tabular-nums text-foreground">
                                  {addOn.batchNumber}
                                </dd>
                              </div>
                            : null}
                            {addOn.topupCheckoutOrderId ?
                              <div className="flex flex-wrap items-baseline gap-x-1.5 sm:col-span-2">
                                <dt className="text-muted-foreground">
                                  Top-up order #
                                </dt>
                                <dd
                                  className="font-mono font-medium tabular-nums text-foreground"
                                  title={addOn.topupCheckoutOrderId}
                                >
                                  {shortOrderId(addOn.topupCheckoutOrderId)}
                                </dd>
                              </div>
                            : null}
                          </dl>
                          {addOn.lines.length > 1 ?
                            <ul className="space-y-1 px-0.5 text-xs text-muted-foreground">
                              {addOn.lines.map((line) => (
                                <li
                                  key={line.orderItemId}
                                  className="line-clamp-1 text-foreground/90"
                                >
                                  {line.productName}
                                </li>
                              ))}
                            </ul>
                          : null}
                          {addOn.topupPaidAt ?
                            <p className="text-[11px] text-muted-foreground">
                              Paid{" "}
                              {new Date(addOn.topupPaidAt).toLocaleString()}
                            </p>
                          : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            : null}

            <div
              className={cn(
                "rounded-xl border border-border/80 bg-muted/40 px-3.5 py-3",
                paidTopups.length > 0 && "ring-1 ring-border/40",
              )}
            >
              <div className="space-y-2 text-sm">
                {paidTopups.length > 0 ?
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">Checkout subtotal</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatUsd(checkoutSubtotalCents)}
                    </span>
                  </div>
                : null}
                {paidTopups.length > 0 ?
                  (() => {
                    const summed = sumPaidTopupBreakdowns(
                      paidTopups.map((a) => a.breakdown),
                    );
                    if (!summed) return null;
                    const sides = toChargeSides(summed);
                    const priorPaidInstallmentCents = paidTopups.reduce(
                      (sum, a) => sum + a.priorPaidInstallmentCents,
                      0,
                    );
                    return (
                      <MerchandiseTopupAmountBreakdownToggle
                        label={
                          <span className="text-muted-foreground">
                            Extra add-ons
                            <span className="ml-1 text-xs tabular-nums text-muted-foreground/80">
                              ({paidTopups.length})
                            </span>
                          </span>
                        }
                        amountCents={addOnTotalCents}
                        mode="paid"
                        priorPaidInstallmentCents={priorPaidInstallmentCents}
                        firstInstallmentBreakdownMode="due"
                        checkoutSubtotalCents={checkoutSubtotalCents}
                        newTotalCents={adjustedTotalCents}
                        checkout={sides.checkout}
                        actual={sides.actual}
                        footnote="Expand Previous top-up for amount-due math; This for the latest payment."
                      />
                    );
                  })()
                : null}
                <div
                  className={cn(
                    "flex items-baseline justify-between gap-3",
                    paidTopups.length > 0 && "border-t border-border/70 pt-2.5",
                  )}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {paidTopups.length > 0 ? "New total" : "Total"}
                  </span>
                  <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                    {formatUsd(
                      paidTopups.length > 0 ?
                        adjustedTotalCents
                      : checkoutSubtotalCents,
                    )}
                  </span>
                </div>
              </div>
              {paidTopups.length > 0 ?
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  New total = original checkout subtotal plus paid purchase-price
                  top-ups.
                </p>
              : null}
            </div>
          </div>
        : null}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
