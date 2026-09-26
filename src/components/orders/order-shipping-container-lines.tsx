import type { ReactNode } from "react";

import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import { formatUsd } from "@/lib/admin-markup";
import {
  containerOfferingKindLabel,
  parseContainerOfferingKind,
} from "@/lib/validations/container-offering";

type OrderShippingContainerLinesProps = {
  lines: OrderContainerLineAdmin[];
  /** Shown on the container title row (customer combined refund). */
  renderLineActions?: (line: OrderContainerLineAdmin) => ReactNode;
  /** Full-width footer under both charges (admin combined approve). */
  renderLineFooter?: (line: OrderContainerLineAdmin) => ReactNode;
};

/** Paid-order shipping container list with packing fee (admin and customer). */
export function OrderShippingContainerLines({
  lines,
  renderLineActions,
  renderLineFooter,
}: OrderShippingContainerLinesProps) {
  if (lines.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-muted/25 ring-1 ring-border/30">
      <header className="border-b border-border/60 bg-muted/50 px-3.5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Shipping containers
        </p>
      </header>
      <ul className="space-y-2.5 p-3" role="list">
        {lines.map((c) => {
          const kind = parseContainerOfferingKind(c.kindSnapshot);
          const packing = Math.max(0, c.packagingFeeCents);
          return (
            <li
              key={c.id}
              className="space-y-0 overflow-hidden rounded-xl border border-border/70 bg-background"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 text-sm font-semibold text-foreground">
                      {c.nameSnapshot}
                    </p>
                    {renderLineActions ? renderLineActions(c) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {containerOfferingKindLabel(kind)}
                    {c.sizeSnapshot.trim() ?
                      <>
                        <span className="mx-1.5 text-border">·</span>
                        {c.sizeSnapshot}
                      </>
                    : null}
                    <span className="mx-1.5 text-border">·</span>
                    Checkout merchandise
                    <span className="mx-1.5 text-border">·</span>
                    Qty {c.quantity}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-base font-semibold tabular-nums text-foreground">
                    {formatUsd(c.lineTotalCents)}
                  </p>
                </div>
              </div>
              {packing > 0 ?
                <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border/60 px-3.5 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Packing fee
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.packagingPerUnitCents > 0 && c.quantity > 0 ?
                        <>
                          {c.quantity} × {formatUsd(c.packagingPerUnitCents)}
                        </>
                      : (
                        "Charged at checkout"
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <p className="text-base font-semibold tabular-nums text-foreground">
                      {formatUsd(packing)}
                    </p>
                  </div>
                </div>
              : null}
              {renderLineFooter ? renderLineFooter(c) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
