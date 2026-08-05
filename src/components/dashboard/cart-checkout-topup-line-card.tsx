"use client";

import { CreditCard } from "lucide-react";

import { AbsoluteExpiryCountdownLabel } from "@/components/dashboard/absolute-expiry-countdown-label";
import { MerchandiseTopupChargePreviewDialog } from "@/components/dashboard/merchandise-topup-charge-preview-dialog";
import type { MerchandiseTopupAddOnChargeView } from "@/data/merchandise-topup-cart";
import { formatUsd } from "@/lib/admin-markup";

type CartCheckoutTopupLineCardProps = {
  charge: MerchandiseTopupAddOnChargeView;
};

export function CartCheckoutTopupLineCard({
  charge,
}: CartCheckoutTopupLineCardProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-5">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted text-primary">
              <CreditCard className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Add-on charge
              </p>
              <p className="text-sm font-semibold leading-snug text-foreground">
                {charge.productName}
              </p>
              <p className="text-xs text-muted-foreground">
                Purchase-price top-up
                {charge.siteLabel ? ` · ${charge.siteLabel}` : null}
                {" · "}Qty {charge.quantity}
              </p>
            </div>
          </div>

          <dl className="grid gap-1.5 rounded-lg border border-border/70 bg-muted/35 px-3 py-2.5 text-xs sm:grid-cols-2">
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
            <ul className="space-y-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs">
              {charge.lines.map((product) => (
                <li
                  key={product.orderItemId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                >
                  <span className="min-w-0 flex-1 line-clamp-2 text-foreground">
                    {product.productName}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    Product #:{" "}
                    <span className="text-foreground">{product.productNumber}</span>
                    {" · "}Qty {product.quantity}
                  </span>
                </li>
              ))}
            </ul>
          : null}

          <div className="flex flex-wrap items-end gap-3">
            {charge.expiresAt ?
              <AbsoluteExpiryCountdownLabel expiresAt={charge.expiresAt} />
            : null}
            <div className="w-[7.5rem]">
              <MerchandiseTopupChargePreviewDialog
                charge={charge}
                label="Preview"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-between gap-2 border-t border-border/50 pt-3 sm:min-w-[6.5rem] sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-right">
            Amount
          </span>
          <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-right">
            {formatUsd(charge.amountCents)}
          </span>
        </div>
      </div>
    </div>
  );
}
