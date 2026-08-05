"use client";

import { EyeIcon } from "lucide-react";

import { MerchandiseTopupAmountBreakdownToggle } from "@/components/merchandise-topup-amount-breakdown-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MerchandiseTopupAddOnChargeView } from "@/data/merchandise-topup-cart";
import { formatUsd } from "@/lib/admin-markup";
import {
  availableReconciliationChargeRows,
  reconciliationChargeTotalCents,
} from "@/lib/merchandise-reconciliation";
import { cn } from "@/lib/utils";

type MerchandiseTopupChargePreviewDialogProps = {
  charge: MerchandiseTopupAddOnChargeView;
  label?: string;
};

export function MerchandiseTopupChargePreviewDialog({
  charge,
  label = "Preview",
}: MerchandiseTopupChargePreviewDialogProps) {
  const checkout = {
    merchandiseCents: charge.breakdown.checkoutMerchandiseCents,
    shippingCents: charge.breakdown.checkoutShippingCents,
    taxCents: charge.breakdown.checkoutTaxCents,
    serviceCents: charge.breakdown.checkoutServiceCents,
  };
  const actual = {
    merchandiseCents: charge.breakdown.actualMerchandiseCents,
    shippingCents: charge.breakdown.actualShippingCents,
    taxCents: charge.breakdown.actualTaxCents,
    serviceCents: charge.breakdown.actualServiceCents,
  };
  const rows = availableReconciliationChargeRows(checkout, actual);
  const checkoutTotal = reconciliationChargeTotalCents(checkout);
  const actualTotal = reconciliationChargeTotalCents(actual);
  const dueCents = Math.max(0, charge.amountCents);
  const grossDelta = Math.max(0, charge.breakdown.deltaCents);
  const priorPaidCents = Math.max(
    0,
    charge.priorPaidNetCents ?? Math.max(0, grossDelta - dueCents),
  );

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(
          "inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent",
        )}
      >
        <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        {label}
      </DialogTrigger>
      <DialogContent className="z-[60] flex max-h-[min(90vh,42rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border px-4 py-3 pr-10">
          <DialogTitle className="text-base">Top-up charge breakdown</DialogTitle>
          <DialogDescription>
            Amounts paid at checkout vs updated charges at purchasing. Pay the
            difference so we can buy this for you.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <p className="text-sm font-medium leading-snug text-foreground">
                {charge.productNames.length > 1 ?
                  charge.productNames.join(" · ")
                : charge.productNames[0]}
              </p>
              <p className="text-xs text-muted-foreground">
                Purchase price top-up · Qty {charge.quantity}
                {charge.siteLabel ? ` · ${charge.siteLabel}` : null}
              </p>
            </div>

            <dl className="grid gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-xs sm:grid-cols-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt className="text-muted-foreground">Top-up #</dt>
                <dd className="font-mono font-medium tabular-nums text-foreground">
                  {charge.topupNumber}
                </dd>
              </div>
              {charge.batchNumber ?
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt className="text-muted-foreground">Batch #</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    {charge.batchNumber}
                  </dd>
                </div>
              : charge.lines.length === 1 ?
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt className="text-muted-foreground">Product #</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    {charge.productNumber}
                  </dd>
                </div>
              : null}
            </dl>

            {charge.lines.length > 1 ?
              <ul className="space-y-1.5 rounded-lg border border-border/70 px-3 py-2 text-xs">
                {charge.lines.map((line) => (
                  <li
                    key={line.orderItemId}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                  >
                    <span className="min-w-0 flex-1 line-clamp-2 text-foreground">
                      {line.productName}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      Product #:{" "}
                      <span className="text-foreground">{line.productNumber}</span>
                      {" · "}Qty {line.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            : null}
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              After checkout
            </h3>
            <ul className="space-y-1 text-sm">
              {rows.map((row) => (
                <li
                  key={`checkout-${row.key}`}
                  className="flex justify-between gap-3 text-muted-foreground"
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums text-foreground">
                    {formatUsd(row.checkoutCents)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t border-border/60 pt-1.5 font-medium text-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatUsd(checkoutTotal)}</span>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              At purchasing
            </h3>
            <ul className="space-y-1 text-sm">
              {rows.map((row) => (
                <li
                  key={`actual-${row.key}`}
                  className="flex justify-between gap-3 text-muted-foreground"
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums text-foreground">
                    {formatUsd(row.actualCents)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t border-border/60 pt-1.5 font-medium text-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatUsd(actualTotal)}</span>
              </li>
            </ul>
          </section>

          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
            <MerchandiseTopupAmountBreakdownToggle
              label={
                <span className="text-sm font-semibold text-foreground">
                  Amount due
                </span>
              }
              amountCents={dueCents}
              mode="due"
              paidTopupCents={priorPaidCents}
              checkout={checkout}
              actual={actual}
              amountClassName="text-lg font-semibold text-foreground"
              footnote={
                priorPaidCents > 0 ?
                  `Difference: +${formatUsd(grossDelta)} · already paid ${formatUsd(priorPaidCents)}.`
                : `Difference: +${formatUsd(grossDelta)}.`
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
