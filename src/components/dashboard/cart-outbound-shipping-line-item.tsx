"use client";

import Link from "next/link";
import { Package } from "lucide-react";

import { OutboundShippingCartRemoveButton } from "@/components/dashboard/outbound-shipping-cart-remove-button";
import { formatUsd } from "@/lib/admin-markup";
import type { OutboundShippingCartLineView } from "@/data/barrel-outbound-shipping-charges";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type CartOutboundShippingLineItemProps = {
  line: OutboundShippingCartLineView;
};

export function CartOutboundShippingLineItem({
  line,
}: CartOutboundShippingLineItemProps) {
  return (
    <li className="flex gap-4 px-4 py-4 sm:px-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/30 text-primary">
        <Package className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">
              Outbound shipping — {line.alias}
            </p>
            <p className="text-sm text-muted-foreground">
              {line.slotLabel} · {containerOfferingKindLabel(line.kind)}
            </p>
          </div>
          <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
            {formatUsd(line.totalCents)}
          </p>
        </div>
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {line.lines.map((cost) => (
            <li key={cost.label} className="flex justify-between gap-4">
              <span>{cost.label}</span>
              <span className="tabular-nums">{formatUsd(cost.amountCents)}</span>
            </li>
          ))}
        </ul>
        {line.adminNote ?
          <p className="text-xs text-muted-foreground">{line.adminNote}</p>
        : null}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <OutboundShippingCartRemoveButton chargeId={line.chargeId} />
          <Link
            href="/dashboard/shipping"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Shipping details
          </Link>
        </div>
      </div>
    </li>
  );
}
