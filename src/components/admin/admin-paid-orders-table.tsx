import Link from "next/link";

import { AdminOrderLineActions } from "@/components/admin/admin-order-line-actions";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import type { AdminPaidOrderLineRow } from "@/data/admin-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { displaySiteName } from "@/lib/site-name";

function customerLabel(row: AdminPaidOrderLineRow): string {
  const name = row.customerFullName?.trim();
  if (name) return name;
  const mail = row.customerEmail?.trim();
  if (mail) return mail;
  return "Customer";
}

export function AdminPaidOrdersTable({
  rows,
  snapshotsByRequestId = {},
}: {
  rows: AdminPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No paid order lines yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[68rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Product</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Customer</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Site</th>
            <th className="px-3 py-2.5 font-medium text-foreground">URL</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Qty</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Line total</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Refunded</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Status</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Ops</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Audit</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Order</th>
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
                    variant="admin"
                    imageUrl={r.productImageUrl}
                    productLabel={r.productName}
                  />
                </td>
                <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
                  <span className="line-clamp-2">
                    {r.productName?.trim() || "Unnamed product"}
                  </span>
                </td>
                <td className="max-w-[10rem] px-3 py-3 align-top text-muted-foreground">
                  <span className="line-clamp-2 text-xs sm:text-sm">
                    {customerLabel(row)}
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
                    Open
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
                <td className="max-w-[11rem] px-3 py-3 align-top">
                  <span
                    className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                    title={fulfillment}
                  >
                    {adminOrderLineStatusLabel(fulfillment)}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">
                  <AdminOrderLineActions
                    orderItemId={row.orderItem.id}
                    fulfillmentStatus={fulfillment}
                    linePriceCents={row.orderItem.price}
                    refundedCents={row.refundedCents}
                    productLabel={r.productName?.trim() || "Item"}
                  />
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
