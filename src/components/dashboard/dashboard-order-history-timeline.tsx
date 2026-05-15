"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import {
  groupPaidRowsStableByOrder,
  partitionPaidLinesIntoBatchBuckets,
} from "@/lib/partition-paid-order-batch-groups";
import { displaySiteName } from "@/lib/site-name";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { cn } from "@/lib/utils";

const POST_CHECKOUT_PHASES = new Set<ItemRequestLineSnapshot["phase"]>([
  "checkout_paid_pending_delivery",
  "company_purchase_pending_delivery",
  "warehouse_delivery_received",
  "product_return_tracking_saved",
  "customer_refund_request_submitted",
]);

type TimelineEvent = {
  id: string;
  label: string;
  headline: string;
  detail: string;
  at: string;
  kind: "snapshot" | "current";
};

type CustomerOrderGroup = {
  key: string;
  name: string;
  email: string | null;
  orderGroups: {
    order: DashboardPaidOrderLineRow["order"];
    lines: DashboardPaidOrderLineRow[];
  }[];
  lineCount: number;
};

function orderLineTimelineEvents(
  row: DashboardPaidOrderLineRow,
  snapshots: ItemRequestLineSnapshot[],
): TimelineEvent[] {
  const filtered = snapshots.filter((snap) => POST_CHECKOUT_PHASES.has(snap.phase));
  const events: TimelineEvent[] = filtered.map((snap, index) => ({
    id: snap.id,
    label: itemRequestLineSnapshotPhaseLabel(snap.phase),
    headline: auditSnapshotStatusHeadline(snap),
    detail: auditSnapshotChangeSummary(snap, index > 0 ? filtered[index - 1]! : null),
    at: snap.createdAt,
    kind: "snapshot" as const,
  }));

  if (!filtered.some((snap) => snap.phase === "checkout_paid_pending_delivery")) {
    events.unshift({
      id: `checkout:${row.orderItem.id}`,
      label: "Checkout paid",
      headline: "Checkout complete from cart",
      detail: `${formatUsd(row.orderItem.price)} recorded for this product line.`,
      at: row.order.createdAt,
      kind: "snapshot",
    });
  }

  const current = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const latestRecordedAt = filtered.at(-1)?.createdAt;
  events.push({
    id: `current:${row.orderItem.id}`,
    label: "Current status",
    headline: dashboardOrderLineStatusLabel(current, {
      pendingRefundRequest: row.pendingRefundRequest != null,
    }),
    detail:
      row.pendingRefundRequest != null
        ? "A refund request is awaiting staff approval."
        : "Latest fulfillment status saved on this order line.",
    at: row.orderItem.warehouseReceivedAt ?? latestRecordedAt ?? row.order.createdAt,
    kind: "current",
  });

  return events;
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}...`;
}

function customerName(row: DashboardPaidOrderLineRow): string {
  return (
    row.customerFullName?.trim() ||
    row.customerEmail?.trim() ||
    "Customer"
  );
}

function customerEmail(row: DashboardPaidOrderLineRow): string | null {
  return row.customerEmail?.trim() || null;
}

function customerGroupKey(row: DashboardPaidOrderLineRow): string {
  const name = row.customerFullName?.trim().toLowerCase() ?? "";
  const email = row.customerEmail?.trim().toLowerCase() ?? "";
  return `${name}|${email}` || "customer";
}

function groupRowsByCustomerAndOrder(
  rows: DashboardPaidOrderLineRow[],
): CustomerOrderGroup[] {
  const ids: string[] = [];
  const map = new Map<string, DashboardPaidOrderLineRow[]>();

  for (const row of rows) {
    const id = customerGroupKey(row);
    if (!map.has(id)) {
      ids.push(id);
      map.set(id, []);
    }
    map.get(id)!.push(row);
  }

  return ids.map((key) => {
    const customerRows = map.get(key)!;
    const first = customerRows[0]!;
    return {
      key,
      name: customerName(first),
      email: customerEmail(first),
      orderGroups: groupPaidRowsStableByOrder(customerRows),
      lineCount: customerRows.length,
    };
  });
}

function ToggleSection({
  title,
  summary,
  children,
  defaultOpen = true,
  className,
  bodyClassName,
  ariaLabel,
}: {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border", className)}>
      <div className="flex flex-wrap items-center gap-3 bg-muted/25 px-3 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">{title}</div>
          {summary ? (
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {summary}
            </div>
          ) : null}
        </div>
      </div>
      {open ? <div className={cn("p-3", bodyClassName)}>{children}</div> : null}
    </section>
  );
}

function ProductHistoryCard({
  row,
  snapshots,
}: {
  row: DashboardPaidOrderLineRow;
  snapshots: ItemRequestLineSnapshot[];
}) {
  const request = row.request;
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const pendingRefund = row.pendingRefundRequest != null;
  const events = orderLineTimelineEvents(row, snapshots);
  const productName = request.productName?.trim() || "Unnamed product";
  const batchDisplay =
    row.resolvedBatchNumber?.trim() ||
    (row.resolvedBatchSessionId ? `Session ${shortId(row.resolvedBatchSessionId)}` : null);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <div className="grid gap-4 border-b border-border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="flex min-w-0 gap-4">
          <ProductRequestThumbnail
            variant="cart"
            imageUrl={request.productImageUrl}
            productLabel={productName}
            className="w-20 max-w-20 sm:w-24 sm:max-w-24"
          />
          <div className="min-w-0 space-y-2">
            <div>
              <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                {productName}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {displaySiteName(request.siteName, request.productUrl)}
                {batchDisplay ? ` - Batch ${batchDisplay}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-background px-2 py-1">
                Order <span className="font-mono">{shortId(row.order.id)}</span>
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-1">
                Product line <span className="font-mono">{shortId(row.orderItem.id)}</span>
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-1 tabular-nums">
                Qty {row.orderItem.quantity}
              </span>
            </div>
            <Link
              href={request.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open product page
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current status
            </p>
            <StatusBadge
              kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
                pendingRefundRequest: pendingRefund,
              })}
              className="mt-1"
              title={fulfillment}
            >
              {dashboardOrderLineStatusLabel(fulfillment, {
                pendingRefundRequest: pendingRefund,
              })}
            </StatusBadge>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <dt className="text-xs text-muted-foreground">Checked out</dt>
              <dd className="tabular-nums text-foreground">
                <time dateTime={row.order.createdAt}>
                  {new Date(row.order.createdAt).toLocaleString()}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Line total</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {formatUsd(row.orderItem.price)}
              </dd>
            </div>
            {row.refundedCents > 0 ? (
              <div>
                <dt className="text-xs text-muted-foreground">Refunded</dt>
                <dd className="tabular-nums font-medium text-foreground">
                  {formatUsd(row.refundedCents)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-4">
          {events.map((event, index) => (
            <div
              key={event.id}
              className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3"
            >
              <div className="relative flex justify-center">
                <span
                  className={`mt-1 size-2.5 rounded-full ${
                    event.kind === "current" ? "bg-primary" : "bg-muted-foreground"
                  }`}
                  aria-hidden
                />
                {index < events.length - 1 ? (
                  <span
                    className="absolute top-4 bottom-[-1rem] w-px bg-border"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {event.label}
                    </p>
                    <p className="mt-1 font-medium leading-snug text-foreground">
                      {event.headline}
                    </p>
                  </div>
                  <time
                    dateTime={event.at}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                  >
                    {new Date(event.at).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {event.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function DashboardOrderHistoryTimeline({
  rows,
  snapshotsByRequestId = {},
}: {
  rows: DashboardPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No product history records on this page.
      </p>
    );
  }

  const customerGroups = groupRowsByCustomerAndOrder(rows);

  return (
    <div className="space-y-5">
      {customerGroups.map((customerGroup) => (
        <ToggleSection
          key={customerGroup.key}
          ariaLabel="Toggle products for this customer"
          title={
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Customer</span>
              <span className="text-sm font-medium text-primary">
                {customerGroup.name}
              </span>
              {customerGroup.email && customerGroup.email !== customerGroup.name ? (
                <span className="text-xs text-muted-foreground">
                  {customerGroup.email}
                </span>
              ) : null}
            </div>
          }
          summary={`${customerGroup.orderGroups.length} order${
            customerGroup.orderGroups.length === 1 ? "" : "s"
          } - ${customerGroup.lineCount} product${
            customerGroup.lineCount === 1 ? "" : "s"
          }`}
          className="bg-background"
          bodyClassName="space-y-4"
        >
          {customerGroup.orderGroups.map(({ order, lines }) => {
            const buckets = partitionPaidLinesIntoBatchBuckets(lines);
            return (
              <ToggleSection
                key={order.id}
                ariaLabel="Toggle products for this order"
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">Order</span>
                    <span className="break-all font-mono text-xs text-primary">
                      {order.id}
                    </span>
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-foreground">
                      {order.status}
                    </span>
                  </div>
                }
                summary={
                  <>
                    <span className="tabular-nums">{formatUsd(order.totalAmount)}</span>
                    {" - "}
                    <span>{lines.length} product{lines.length === 1 ? "" : "s"}</span>
                    {" - "}
                    <time dateTime={order.createdAt}>
                      {new Date(order.createdAt).toLocaleString()}
                    </time>
                  </>
                }
                className="bg-card"
                bodyClassName="space-y-3"
              >
                {buckets.map((bucket, index) => {
                  const bucketKey =
                    bucket.kind === "batch"
                      ? bucket.batchSessionId
                      : `single:${order.id}:${index}`;
                  const title =
                    bucket.kind === "batch" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">Batch group</span>
                        <span className="font-mono text-xs text-primary">
                          {bucket.batchNumber?.trim() || shortId(bucket.batchSessionId)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-medium text-foreground">Single products</span>
                    );

                  return (
                    <ToggleSection
                      key={bucketKey}
                      ariaLabel={
                        bucket.kind === "batch"
                          ? "Toggle products for this batch group"
                          : "Toggle single products for this order"
                      }
                      title={title}
                      summary={`${bucket.lines.length} product${
                        bucket.lines.length === 1 ? "" : "s"
                      }`}
                      className="bg-background/70"
                      bodyClassName="space-y-3"
                    >
                      {bucket.lines.map((row) => (
                        <ProductHistoryCard
                          key={row.orderItem.id}
                          row={row}
                          snapshots={snapshotsByRequestId[row.request.id] ?? []}
                        />
                      ))}
                    </ToggleSection>
                  );
                })}
              </ToggleSection>
            );
          })}
        </ToggleSection>
      ))}
    </div>
  );
}
