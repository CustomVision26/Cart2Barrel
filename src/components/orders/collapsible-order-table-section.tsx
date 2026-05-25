"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { usePaidOrderAccordionOptional } from "@/components/orders/paid-order-accordion";
import { cn } from "@/lib/utils";

type CollapsibleOrderTableSectionProps = {
  /** Same order `id` as in `order.id` — required for accordion on paid orders tables. */
  orderId: string;
  colSpan: number;
  lineCount: number;
  /** Order summary (id, status, total, date, line count) — no outer flex wrapper. */
  summaryContent: ReactNode;
  children: ReactNode;
  tbodyClassName?: string;
};

/**
 * Order header row + collapsible product / batch line rows (same tbody, valid HTML).
 */
export function CollapsibleOrderTableSection({
  orderId,
  colSpan,
  lineCount,
  summaryContent,
  children,
  tbodyClassName,
}: CollapsibleOrderTableSectionProps) {
  const accordion = usePaidOrderAccordionOptional();
  const [localProductsOpen, setLocalProductsOpen] = useState(true);
  const hasProducts = lineCount > 0;

  const productsOpen = accordion ?
    accordion.openOrderId === orderId
  : localProductsOpen;

  const toggleProducts = () => {
    if (!hasProducts) return;
    if (accordion) {
      if (accordion.openOrderId === orderId) {
        accordion.setExpandedOrderId(null);
      } else {
        accordion.setExpandedOrderId(orderId);
      }
    } else {
      setLocalProductsOpen((prev) => !prev);
    }
  };

  return (
    <tbody
      className={cn(
        "divide-y divide-border [&:not(:last-child)]:border-b-8 [&:not(:last-child)]:border-border/40",
        tbodyClassName,
      )}
    >
      <tr className="bg-muted">
        <td className="px-3 py-2.5 text-xs text-muted-foreground" colSpan={colSpan}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {hasProducts ?
              <button
                type="button"
                onClick={toggleProducts}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={productsOpen}
                aria-label={productsOpen ? "Hide products for this order" : "Show products for this order"}
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    productsOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </button>
            : null}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              {summaryContent}
            </div>
          </div>
        </td>
      </tr>
      {hasProducts && productsOpen ? children : null}
    </tbody>
  );
}
