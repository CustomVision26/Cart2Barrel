import Link from "next/link";

import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { displaySiteName } from "@/lib/site-name";

export function DashboardPaidOrdersTable({
  rows,
  snapshotsByRequestId = {},
}: {
  rows: DashboardPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No paid orders yet. When you complete checkout, lines appear here with fulfillment
        status.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[58rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Product</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Site</th>
            <th className="px-3 py-2.5 font-medium text-foreground">URL</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Qty</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Line total</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Refunded</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Status</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Audit</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Paid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const r = row.request;
            const fulfillment = effectiveOrderItemFulfillmentStatus(
              row.orderItem,
              row.order
            );
            return (
              <tr key={row.orderItem.id} className="align-top">
                <td className="px-3 py-3 align-top">
                  <ProductRequestThumbnail
                    variant="list"
                    imageUrl={r.productImageUrl}
                    productLabel={r.productName}
                  />
                </td>
                <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
                  <span className="line-clamp-2">
                    {r.productName?.trim() || "Unnamed product"}
                  </span>
                </td>
                <td className="max-w-[8rem] px-3 py-3 align-top text-muted-foreground">
                  <span className="line-clamp-2 text-xs sm:text-sm">
                    {displaySiteName(r.siteName, r.productUrl)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top">
                  <Link
                    href={r.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Product url
                  </Link>
                </td>
                <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">
                  {row.orderItem.quantity}
                </td>
                <td className="px-3 py-3 align-top font-medium tabular-nums text-foreground">
                  {formatUsd(row.orderItem.price)}
                </td>
                <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">
                  {row.refundedCents > 0 ? (
                    <>
                      {formatUsd(row.refundedCents)}
                      {row.refundedCents < row.orderItem.price ? (
                        <span className="mt-0.5 block text-xs">
                          Net {formatUsd(row.orderItem.price - row.refundedCents)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[14rem] px-3 py-3 align-top">
                  <div className="space-y-1">
                    <span
                      className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                      title={fulfillment}
                    >
                      {dashboardOrderLineStatusLabel(fulfillment)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <ItemRequestLineAuditDialog
                    itemRequestId={r.id}
                    productLabel={r.productName?.trim() || ""}
                    snapshots={snapshotsByRequestId[r.id] ?? []}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
                  <time dateTime={row.order.createdAt}>
                    {new Date(row.order.createdAt).toLocaleString()}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
