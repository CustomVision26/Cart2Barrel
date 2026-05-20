"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OrderItemRefundDetail } from "@/data/order-item-refunds";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

function receiptHref(stripeRefundId: string): string {
  return `/api/dashboard/stripe-refund-receipt?stripeRefundId=${encodeURIComponent(stripeRefundId)}`;
}

function ReceiptDownloadLink({
  refund,
  label,
  className,
}: {
  refund: OrderItemRefundDetail;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={receiptHref(refund.stripeRefundId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-xs font-medium text-primary underline-offset-2 hover:underline",
        className,
      )}
    >
      {label}
    </a>
  );
}

export function DashboardStripeRefundReceiptLinks({
  refunds,
}: {
  refunds: OrderItemRefundDetail[];
}) {
  const withStripe = refunds.filter((r) => r.stripeRefundId?.trim());
  if (withStripe.length === 0) return null;

  if (withStripe.length === 1) {
    const refund = withStripe[0]!;
    return (
      <ReceiptDownloadLink
        refund={refund}
        label="Download proration receipt"
        className="mt-2 block"
      />
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "link", size: "sm" }),
          "mt-2 h-auto p-0 text-xs font-medium",
        )}
      >
        Download proration receipts ({withStripe.length})
      </DialogTrigger>
      <DialogContent className="max-h-[min(85vh,520px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proration receipts</DialogTitle>
          <DialogDescription>
            Each partial refund has its own Stripe receipt. Open any link below to
            download or view it.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {withStripe.map((refund, i) => (
            <li
              key={refund.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium tabular-nums text-foreground">
                  Refund {i + 1} · {formatUsd(refund.amountCents)}
                </p>
                <time
                  dateTime={refund.createdAt}
                  className="block text-xs text-muted-foreground"
                >
                  {new Date(refund.createdAt).toLocaleString()}
                </time>
              </div>
              <ReceiptDownloadLink
                refund={refund}
                label="Download receipt"
                className="shrink-0"
              />
            </li>
          ))}
        </ul>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
