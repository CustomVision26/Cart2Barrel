"use client";

import Link from "next/link";

import { OutboundShippingCartRemoveButton } from "@/components/dashboard/outbound-shipping-cart-remove-button";
import { formatUsd } from "@/lib/admin-markup";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  sumOutboundChargesCents,
  unpaidPublishedCharges,
} from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

export function OutboundShippingAddedChargesPanel({
  charges,
  className,
}: {
  charges: BarrelOutboundShippingChargeView[];
  className?: string;
}) {
  const added = unpaidPublishedCharges(charges).filter((charge) => charge.inCart);
  const totalCents = sumOutboundChargesCents(added);

  return (
    <aside
      className={cn(
        "flex min-h-64 flex-col rounded-lg border border-border/80 bg-background/80 p-3",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">Added to cart</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Charges you add appear here with a running total.
      </p>

      {added.length === 0 ?
        <p className="mt-4 text-sm text-muted-foreground">
          No charges added yet.
        </p>
      : (
        <div className="mt-3 flex flex-1 flex-col gap-3">
          <ul className="space-y-3">
            {added.map((charge) => {
              const kindLabel =
                BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind];
              const title =
                charge.partnerName?.trim() || charge.lines[0]?.label || kindLabel;
              return (
                <li
                  key={charge.chargeId}
                  className="rounded-md border border-border/70 bg-card px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {kindLabel}
                      </p>
                      <p className="text-sm font-medium text-foreground">{title}</p>
                    </div>
                    <OutboundShippingCartRemoveButton chargeId={charge.chargeId} />
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {charge.lines.map((line) => (
                      <li
                        key={line.label}
                        className="flex justify-between gap-3"
                      >
                        <span>{line.label}</span>
                        <span className="tabular-nums">
                          {formatUsd(line.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 flex justify-between gap-3 text-sm font-medium text-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      {formatUsd(charge.totalCents)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto border-t border-border/70 pt-2">
            <p className="flex justify-between gap-3 text-sm font-semibold text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{formatUsd(totalCents)}</span>
            </p>
            <Link
              href="/dashboard/cart"
              className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              View cart
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
