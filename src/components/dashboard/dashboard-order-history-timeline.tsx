"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { useAdminNestedPanelFocus } from "@/components/admin/admin-nested-panel-focus-context";

import {
  DashboardOrderHistoryEventPreviewDialog,
  type OrderHistoryTimelinePreview,
} from "@/components/dashboard/dashboard-order-history-event-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import { isHiddenTimelineSnapshotSummary } from "@/lib/audit-snapshot-duplicate-copy";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import {
  chronologicalPreviousSnapshot,
  filterDuplicateFrozenCopySnapshots,
} from "@/lib/snapshot-tracking-display";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import {
  orderLineCurrentStatusDetail,
  orderLineCurrentStatusRecordedAt,
  orderLineStatusLabelOpts,
} from "@/lib/order-line-current-status-display";
import {
  groupPaidRowsStableByOrder,
  partitionPaidLinesIntoBatchBuckets,
} from "@/lib/partition-paid-order-batch-groups";
import { displaySiteName } from "@/lib/site-name";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { cn } from "@/lib/utils";

const POST_CHECKOUT_PHASES = new Set<ItemRequestLineSnapshot["phase"]>([
  "checkout_paid_pending_delivery",
  "outside_purchase_checkout_paid",
  "company_purchase_pending_delivery",
  "warehouse_delivery_received",
  "product_return_requested",
  "product_return_tracking_saved",
  "customer_refund_request_submitted",
]);

type TimelineEvent = {
  id: string;
  label: string;
  headline: string;
  detail: string;
  at: string;
  kind: "snapshot" | "current" | "checkout_fallback";
  preview: OrderHistoryTimelinePreview;
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
  const filtered = filterDuplicateFrozenCopySnapshots(
    snapshots.filter((snap) => POST_CHECKOUT_PHASES.has(snap.phase)),
    snapshots,
  );
  const events: TimelineEvent[] = filtered.map((snap) => {
    const prev = chronologicalPreviousSnapshot(snap, snapshots);
    return {
      id: snap.id,
      label: itemRequestLineSnapshotPhaseLabel(snap.phase),
      headline: auditSnapshotStatusHeadline(snap),
      detail: auditSnapshotChangeSummary(snap, prev),
      at: snap.createdAt,
      kind: "snapshot" as const,
      preview: {
        kind: "snapshot" as const,
        snapshot: snap,
        prevSnapshot: prev,
        warehouseProofPhotoUrls:
          snap.phase === "warehouse_delivery_received" ?
            row.orderItem.warehouseReceivedProofPhotoUrls ?? null
          : null,
      },
    };
  }).filter(
    (event) =>
      event.kind !== "snapshot" ||
      !isHiddenTimelineSnapshotSummary(event.detail),
  );

  const hasCheckoutSnapshot = filtered.some(
    (snap) =>
      snap.phase === "checkout_paid_pending_delivery" ||
      snap.phase === "outside_purchase_checkout_paid",
  );
  if (!hasCheckoutSnapshot) {
    events.unshift({
      id: `checkout:${row.orderItem.id}`,
      label: "Checkout paid",
      headline: "Checkout complete from cart",
      detail: `${formatUsd(row.orderItem.price)} recorded for this product line.`,
      at: row.order.createdAt,
      kind: "checkout_fallback",
      preview: { kind: "checkout_fallback", row },
    });
  }

  const current = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const statusContext = {
    orderItem: row.orderItem,
    order: row.order,
    pendingRefundRequest: row.pendingRefundRequest,
    pendingProductReturnRequest: row.pendingProductReturnRequest,
    fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
    refundedCents: row.refundedCents,
  };
  const latestRecordedAt = filtered.at(-1)?.createdAt;
  events.push({
    id: `current:${row.orderItem.id}`,
    label: "Current status",
    headline: dashboardOrderLineStatusLabel(
      current,
      orderLineStatusLabelOpts(statusContext),
    ),
    detail: orderLineCurrentStatusDetail(statusContext),
    at: orderLineCurrentStatusRecordedAt(statusContext, latestRecordedAt),
    kind: "current",
    preview: { kind: "current", row },
  });

  return [...events].reverse();
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

function historyLineMatchesQuery(
  row: DashboardPaidOrderLineRow,
  q: string,
): boolean {
  if (!q) return true;
  const r = row.request;
  const chunks = [
    r.id,
    r.productName,
    r.productUrl,
    displaySiteName(r.siteName, r.productUrl),
    row.order.id,
    row.orderItem.id,
    row.resolvedBatchNumber,
    row.resolvedBatchSessionId,
  ];
  return chunks.some(
    (chunk) => chunk != null && String(chunk).toLowerCase().includes(q),
  );
}

function ToggleSection({
  title,
  summary,
  children,
  defaultOpen = true,
  open: openControlled,
  onOpenChange,
  className,
  bodyClassName,
  ariaLabel,
}: {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  bodyClassName?: string;
  ariaLabel: string;
}) {
  const [openUncontrolled, setOpenUncontrolled] = useState(defaultOpen);
  const open = openControlled ?? openUncontrolled;
  const setOpen = (next: boolean) => {
    if (openControlled === undefined) setOpenUncontrolled(next);
    onOpenChange?.(next);
  };

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border", className)}>
      <div className="flex flex-wrap items-center gap-3 bg-muted px-3 py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  const statusContext = {
    orderItem: row.orderItem,
    order: row.order,
    pendingRefundRequest: row.pendingRefundRequest,
    pendingProductReturnRequest: row.pendingProductReturnRequest,
    fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
    refundedCents: row.refundedCents,
  };
  const statusLabelOpts = orderLineStatusLabelOpts(statusContext);
  const statusRecordedAt = orderLineCurrentStatusRecordedAt(
    statusContext,
    snapshots.filter((snap) => POST_CHECKOUT_PHASES.has(snap.phase)).at(-1)
      ?.createdAt,
  );
  const events = orderLineTimelineEvents(row, snapshots);
  const productName = request.productName?.trim() || "Unnamed product";
  const batchDisplay =
    row.resolvedBatchNumber?.trim() ||
    (row.resolvedBatchSessionId ? `Session ${shortId(row.resolvedBatchSessionId)}` : null);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <div className="grid gap-4 border-b border-border bg-muted p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
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
                pendingProductReturnRequest:
                  row.pendingProductReturnRequest != null,
              })}
              className="mt-1"
              title={fulfillment}
            >
              {dashboardOrderLineStatusLabel(fulfillment, statusLabelOpts)}
            </StatusBadge>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <dt className="text-xs text-muted-foreground">Status updated</dt>
              <dd className="tabular-nums text-foreground">
                <time dateTime={statusRecordedAt}>
                  {new Date(statusRecordedAt).toLocaleString()}
                </time>
              </dd>
            </div>
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

      <ToggleSection
        ariaLabel="Toggle track record log for this product"
        title={
          <span className="text-sm font-semibold text-foreground">Track record log</span>
        }
        summary={`${events.length} status event${events.length === 1 ? "" : "s"} after checkout`}
        className="border-0 bg-transparent"
        bodyClassName="px-4 pb-4 pt-0"
        defaultOpen
      >
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
              <div className="rounded-lg border border-border/80 bg-muted p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {event.label}
                    </p>
                    <p className="mt-1 font-medium leading-snug text-foreground">
                      {event.headline}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <time
                      dateTime={event.at}
                      className="text-xs tabular-nums text-muted-foreground"
                    >
                      {new Date(event.at).toLocaleString()}
                    </time>
                    <DashboardOrderHistoryEventPreviewDialog
                      eventLabel={event.label}
                      eventHeadline={event.headline}
                      preview={event.preview}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {event.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ToggleSection>
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
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No product history records on this page.
      </p>
    );
  }

  const baseId = useId();
  const { setNestedPanelActive } = useAdminNestedPanelFocus();
  const customerGroups = groupRowsByCustomerAndOrder(rows);
  const [openCustomerKey, setOpenCustomerKey] = useState<string | null>(null);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] = useState<10 | 5 | 25 | 50>(10);
  const [linePage, setLinePage] = useState(1);

  const activeCustomerKey =
    panelChoiceMade ? openCustomerKey : (customerGroups[0]?.key ?? null);

  useEffect(() => {
    setNestedPanelActive(activeCustomerKey != null);
  }, [activeCustomerKey, setNestedPanelActive]);

  const openCustomer = customerGroups.find((g) => g.key === activeCustomerKey);
  const openCustomerRows = openCustomer
    ? openCustomer.orderGroups.flatMap(({ lines }) => lines)
    : [];
  const searchNorm = lineSearch.trim().toLowerCase();
  const filteredOpenRows = openCustomerRows.filter((row) =>
    historyLineMatchesQuery(row, searchNorm),
  );
  const lineCount = filteredOpenRows.length;
  const lineTotalPages = Math.max(1, Math.ceil(lineCount / linePageSize));
  const linePageSafe = Math.min(Math.max(1, linePage), lineTotalPages);
  const lineStart = (linePageSafe - 1) * linePageSize;
  const pagedOpenRows = filteredOpenRows.slice(lineStart, lineStart + linePageSize);
  const pagedOpenRowIds = new Set(pagedOpenRows.map((row) => row.orderItem.id));
  const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
  const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

  return (
    <div className="space-y-5">
      {customerGroups.map((customerGroup) => {
        const expanded = activeCustomerKey === customerGroup.key;
        return (
        <ToggleSection
          key={customerGroup.key}
          ariaLabel="Toggle products for this customer"
          open={expanded}
          onOpenChange={(next) => {
            setPanelChoiceMade(true);
            if (next) {
              setOpenCustomerKey(customerGroup.key);
              setLineSearch("");
              setLinePage(1);
              setOpenOrderId(null);
            } else if (activeCustomerKey === customerGroup.key) {
              setOpenCustomerKey(null);
            }
          }}
          defaultOpen={false}
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
          {expanded ? (
            <AdminNestedFindOrganizePanel
              switchId={`${baseId}-line-find-organize-${customerGroup.key}`}
              searchInputId={`${baseId}-line-search-${customerGroup.key}`}
              pageSizeSelectId={`${baseId}-line-page-size-${customerGroup.key}`}
              visible={lineFindOrganizeVisible}
              onVisibleChange={setLineFindOrganizeVisible}
              search={lineSearch}
              onSearchChange={(value) => {
                setLineSearch(value);
                setLinePage(1);
              }}
              searchLabel="Search product history"
              searchPlaceholder="Product, URL, order id, line id, batch…"
              pageSize={linePageSize}
              onPageSizeChange={(size) => {
                setLinePageSize(size);
                setLinePage(1);
              }}
              pageSizeLabel="Products per page"
              showFrom={lineShowFrom}
              showTo={lineShowTo}
              totalCount={lineCount}
              totalLoaded={customerGroup.lineCount}
              itemLabel="product"
              emptyMessage="No product history for this customer."
              noMatchMessage="No products match the current search."
              className="mb-0"
            />
          ) : null}
          {(expanded
            ? customerGroup.orderGroups
                .map(({ order, lines }) => ({
                  order,
                  lines: lines.filter((line) =>
                    pagedOpenRowIds.has(line.orderItem.id),
                  ),
                }))
                .filter(({ lines }) => lines.length > 0)
            : customerGroup.orderGroups
          ).map(({ order, lines }) => {
            const buckets = partitionPaidLinesIntoBatchBuckets(lines);
            return (
              <ToggleSection
                key={order.id}
                ariaLabel="Toggle products for this order"
                open={openOrderId === order.id}
                onOpenChange={(next) => {
                  setOpenOrderId(next ? order.id : null);
                }}
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
                      className="bg-card"
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
        );
      })}
    </div>
  );
}
