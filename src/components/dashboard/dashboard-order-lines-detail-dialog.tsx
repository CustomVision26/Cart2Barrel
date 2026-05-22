"use client";

import { Fragment } from "react";

import { DashboardCheckoutChargesPreviewDialog } from "@/components/dashboard/dashboard-checkout-charges-preview-dialog";
import { DashboardOrderDataRow } from "@/components/dashboard/dashboard-paid-orders-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import type { OrderSlideGroup } from "@/lib/admin-orders-slide-filters";
import { formatUsd } from "@/lib/admin-markup";
import { partitionPaidLinesIntoBatchBuckets } from "@/lib/partition-paid-order-batch-groups";
import { cn } from "@/lib/utils";

export function DashboardOrderLinesDetailDialog({
  open,
  onOpenChange,
  group,
  snapshotsByRequestId = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: (OrderSlideGroup & { lines: DashboardPaidOrderLineRow[] }) | null;
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
}) {
  if (!group) return null;

  const buckets = partitionPaidLinesIntoBatchBuckets(group.lines);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[min(96vw,80rem)] max-w-[min(96vw,80rem)] flex-col gap-0 overflow-hidden p-0",
          "max-h-[min(92vh,56rem)] sm:max-w-[min(96vw,80rem)]",
        )}
      >
        <DialogHeader className="shrink-0 gap-3 border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
          <DialogTitle className="text-left text-lg">Order products</DialogTitle>
          <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-0.5 sm:col-span-2 lg:col-span-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Order id
              </p>
              <p
                className="break-all font-mono text-xs text-foreground"
                title={group.order.id}
              >
                {group.order.id}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total
              </p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatUsd(group.order.totalAmount)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Checked out
              </p>
              <p className="text-sm tabular-nums text-foreground">
                <time dateTime={group.order.createdAt}>
                  {new Date(group.order.createdAt).toLocaleString()}
                </time>
              </p>
            </div>
          </div>
          <DialogDescription className="text-left text-xs">
            Grouped by batch and single items. Scroll horizontally if columns extend past the
            edge.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <p className="mb-2 text-xs text-muted-foreground">
            ← Scroll inside the box below to see Photo, Product, Tracking, and other columns →
          </p>
          <div
            className={cn(
              "max-h-[min(58vh,40rem)] overflow-auto rounded-lg border border-border bg-background",
              "[scrollbar-color:var(--primary)_var(--muted)] [scrollbar-width:thin]",
              "[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/60 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted",
            )}
          >
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-sm">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Photo
                  </th>
                  <th className="min-w-[10rem] whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Product
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Site
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    URL
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Qty
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Line total
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Refunded
                  </th>
                  <th className="min-w-[9rem] whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Fulfillment
                  </th>
                  <th className="min-w-[8rem] whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Tracking
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Refund
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Audit
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Checked out
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket, bi) => {
                  if (bucket.kind === "batch") {
                    return (
                      <Fragment key={bucket.batchSessionId}>
                        <tr className="bg-muted/50">
                          <td
                            colSpan={12}
                            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                          >
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span>
                                Batch{" "}
                                <span className="font-mono text-primary">
                                  {bucket.batchNumber ??
                                    `${bucket.batchSessionId.slice(0, 8)}…`}
                                </span>
                                {" · "}
                                {bucket.lines.length}{" "}
                                {bucket.lines.length === 1 ? "product" : "products"}
                              </span>
                              <DashboardCheckoutChargesPreviewDialog
                                scope="batch"
                                orderId={group.order.id}
                                batchSessionId={bucket.batchSessionId}
                                triggerLabel="Preview batch charges"
                              />
                            </span>
                          </td>
                        </tr>
                        {bucket.lines.map((row) => (
                          <DashboardOrderDataRow
                            key={row.orderItem.id}
                            row={row}
                            snapshotsByRequestId={snapshotsByRequestId}
                          />
                        ))}
                      </Fragment>
                    );
                  }
                  return (
                    <Fragment key={`single:${group.order.id}:${bi}`}>
                      <tr className="bg-muted/50">
                        <td
                          colSpan={12}
                          className={cn(
                            "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground",
                            buckets.length > 1 && "text-muted-foreground",
                          )}
                        >
                          Single {bucket.lines.length === 1 ? "product" : "products"}
                        </td>
                      </tr>
                      {bucket.lines.map((row) => (
                        <DashboardOrderDataRow
                          key={row.orderItem.id}
                          row={row}
                          snapshotsByRequestId={snapshotsByRequestId}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <DashboardCheckoutChargesPreviewDialog
              scope="order"
              orderId={group.order.id}
              triggerLabel="Preview checkout charges"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
