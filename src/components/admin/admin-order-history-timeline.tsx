"use client";

import { ChevronDown, Package } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminPaidOrderLineRow } from "@/data/admin-order-lines";
import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  containerOfferingKindLabel,
  parseContainerOfferingKind,
} from "@/lib/validations/container-offering";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
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

function shortId(id: string): string {
  return `${id.slice(0, 8)}...`;
}

function customerLabel(row: AdminPaidOrderLineRow): string {
  return (
    row.customerFullName?.trim() ||
    row.customerEmail?.trim() ||
    `Customer ${shortId(row.order.clerkUserId)}`
  );
}

function groupRowsByCustomer(rows: AdminPaidOrderLineRow[]) {
  const order: string[] = [];
  const map = new Map<string, AdminPaidOrderLineRow[]>();
  for (const row of rows) {
    const key = row.order.clerkUserId;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(row);
  }
  return order.map((key) => {
    const customerRows = map.get(key)!;
    const first = customerRows[0]!;
    return {
      key,
      label: customerLabel(first),
      email: first.customerEmail?.trim() || null,
      orderGroups: groupPaidRowsStableByOrder(customerRows),
      lineCount: customerRows.length,
    };
  });
}

function orderLineTimelineEvents(
  row: AdminPaidOrderLineRow,
  snapshots: ItemRequestLineSnapshot[],
): TimelineEvent[] {
  const filtered = snapshots.filter((snap) => POST_CHECKOUT_PHASES.has(snap.phase));
  const events: TimelineEvent[] = filtered.map((snap, index) => ({
    id: snap.id,
    label: itemRequestLineSnapshotPhaseLabel(snap.phase),
    headline: auditSnapshotStatusHeadline(snap),
    detail: auditSnapshotChangeSummary(snap, index > 0 ? filtered[index - 1]! : null),
    at: snap.createdAt,
    kind: "snapshot",
  }));

  if (!filtered.some((snap) => snap.phase === "checkout_paid_pending_delivery")) {
    events.unshift({
      id: `checkout:${row.orderItem.id}`,
      label: "Checkout paid",
      headline: "Checkout complete from cart",
      detail: `${formatUsd(row.orderItem.price)} was captured for this product line.`,
      at: row.order.createdAt,
      kind: "snapshot",
    });
  }

  const current = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  events.push({
    id: `current:${row.orderItem.id}`,
    label: "Current fulfillment",
    headline: adminOrderLineStatusLabel(current, {
      pendingRefundRequest: row.pendingRefundRequest != null,
    }),
    detail:
      row.pendingRefundRequest != null
        ? "A shopper refund request is waiting for staff review."
        : "Latest fulfillment state currently saved on this product line.",
    at: row.orderItem.warehouseReceivedAt ?? filtered.at(-1)?.createdAt ?? row.order.createdAt,
    kind: "current",
  });

  return events;
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
            className={cn("size-4 transition-transform", open ? "rotate-180" : "rotate-0")}
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
  row: AdminPaidOrderLineRow;
  snapshots: ItemRequestLineSnapshot[];
}) {
  const [open, setOpen] = useState(true);
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
      <button
        type="button"
        className="flex w-full flex-col gap-2 border-b border-border bg-muted/25 p-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-start gap-3">
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 transition-transform",
              open ? "rotate-180" : "rotate-0",
            )}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="line-clamp-1 text-sm font-semibold text-foreground">
              {productName}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {batchDisplay ? `Batch ${batchDisplay}` : "Single product"} - Order{" "}
              <span className="font-mono">{shortId(row.order.id)}</span> - Line{" "}
              <span className="font-mono">{shortId(row.orderItem.id)}</span>
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusBadge
            kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
              pendingRefundRequest: pendingRefund,
            })}
            title={fulfillment}
          >
            {adminOrderLineStatusLabel(fulfillment, {
              pendingRefundRequest: pendingRefund,
            })}
          </StatusBadge>
          <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
            {open ? "Hide product" : "Show product"}
          </span>
        </span>
      </button>
      {open ? (
        <>
      <div className="grid gap-4 border-b border-border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="flex min-w-0 gap-4">
          <ProductRequestThumbnail
            variant="cart"
            imageUrl={request.productImageUrl}
            productLabel={productName}
            className="w-20 max-w-20 sm:w-24 sm:max-w-24"
          />
          <div className="min-w-0 space-y-2">
            <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
              {productName}
            </h2>
            <p className="text-xs text-muted-foreground">
              {displaySiteName(request.siteName, request.productUrl)}
              {batchDisplay ? ` - Batch ${batchDisplay}` : " - Single product"}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-background px-2 py-1">
                Order <span className="font-mono">{shortId(row.order.id)}</span>
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-1">
                Line <span className="font-mono">{shortId(row.orderItem.id)}</span>
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
              Current fulfillment
            </p>
            <StatusBadge
              kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
                pendingRefundRequest: pendingRefund,
              })}
              className="mt-1"
              title={fulfillment}
            >
              {adminOrderLineStatusLabel(fulfillment, {
                pendingRefundRequest: pendingRefund,
              })}
            </StatusBadge>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <dt className="text-xs text-muted-foreground">Checkout date</dt>
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
            <div key={event.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
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
        </>
      ) : null}
    </article>
  );
}

export function AdminOrderHistoryTimeline({
  rows,
  snapshotsByRequestId = {},
  orderContainerLinesByOrderId = {},
}: {
  rows: AdminPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  orderContainerLinesByOrderId?: Record<string, OrderContainerLineAdmin[]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No product history records on this page.
      </p>
    );
  }

  const customerGroups = groupRowsByCustomer(rows);

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
                {customerGroup.label}
              </span>
              {customerGroup.email && customerGroup.email !== customerGroup.label ? (
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
            const containerLines = orderContainerLinesByOrderId[order.id] ?? [];
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
                    <span>
                      {lines.length} product{lines.length === 1 ? "" : "s"}
                      {containerLines.length > 0 ?
                        <>
                          , {containerLines.length} container
                          {containerLines.length === 1 ? "" : "s"}
                        </>
                      : null}
                    </span>
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
                  return (
                    <ToggleSection
                      key={bucketKey}
                      ariaLabel={
                        bucket.kind === "batch"
                          ? "Toggle products for this batch group"
                          : "Toggle single products for this order"
                      }
                      title={
                        bucket.kind === "batch" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">Batch group</span>
                            <span className="font-mono text-xs text-primary">
                              {bucket.batchNumber?.trim() || shortId(bucket.batchSessionId)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            Single products
                          </span>
                        )
                      }
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
                {containerLines.length > 0 ?
                  <ToggleSection
                    ariaLabel="Toggle shipping containers for this order"
                    title={
                      <div className="flex flex-wrap items-center gap-2">
                        <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="font-medium text-foreground">Shipping containers</span>
                      </div>
                    }
                    summary={`${containerLines.length} checkout line${
                      containerLines.length === 1 ? "" : "s"
                    }`}
                    className="bg-background/70"
                    bodyClassName="space-y-2"
                  >
                    {containerLines.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2 text-sm"
                      >
                        <p className="font-medium text-foreground">{c.nameSnapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {containerOfferingKindLabel(
                            parseContainerOfferingKind(c.kindSnapshot),
                          )}{" "}
                          · {c.sizeSnapshot} · Qty {c.quantity} ·{" "}
                          {formatUsd(c.unitPriceCents)} each · Line{" "}
                          <span className="font-mono">{shortId(c.id)}</span>
                        </p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                          {formatUsd(c.lineTotalCents)}
                        </p>
                      </div>
                    ))}
                  </ToggleSection>
                : null}
              </ToggleSection>
            );
          })}
        </ToggleSection>
      ))}
    </div>
  );
}
