import Link from "next/link";

import { countPendingRefundRequestsAll } from "@/data/order-item-refund-requests";

export async function AdminRefundQueueBanner() {
  const n = await countPendingRefundRequestsAll();
  if (n < 1) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
      <p className="font-medium text-amber-950 dark:text-amber-50">
        {n === 1
          ? "1 shopper refund request awaits staff approval."
          : `${n} shopper refund requests await staff approval.`}
      </p>
      <p className="mt-1 text-xs leading-snug text-amber-900/85 dark:text-amber-100/90">
        Approve or decline from the Ops column on Orders, Purchase orders, or Packages. Issuing an
        approval runs Stripe and emails the shopper a receipt where enabled.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className="inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted/80"
          prefetch={false}
        >
          Orders
        </Link>
        <Link
          href="/admin/purchase-orders"
          className="inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted/80"
          prefetch={false}
        >
          Purchase orders
        </Link>
        <Link
          href="/admin/packages"
          className="inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted/80"
          prefetch={false}
        >
          Packages
        </Link>
      </div>
    </div>
  );
}
