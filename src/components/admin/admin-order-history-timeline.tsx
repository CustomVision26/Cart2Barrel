"use client";

import { ChevronDown, Package } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { resolveOrderLineUpdatedByClerkUserId } from "@/lib/admin-staff-profiles";
import { useAdminNestedPanelFocus } from "@/components/admin/admin-nested-panel-focus-context";

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
  "outside_purchase_checkout_paid",
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
      fullName: first.customerFullName,
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
      warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
    }),
    detail:
      row.pendingRefundRequest != null
        ? "A shopper refund request is waiting for staff review."
        : "Latest fulfillment state currently saved on this product line.",
    at: row.orderItem.warehouseReceivedAt ?? filtered.at(-1)?.createdAt ?? row.order.createdAt,
    kind: "current",
  });

  return [...events].reverse();
}

function ToggleSection({
  title,
  summary,
  children,
  defaultOpen = true,
  open: openProp,
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
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
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
  staffProfilesByClerkUserId,
}: {
  row: AdminPaidOrderLineRow;
  snapshots: ItemRequestLineSnapshot[];
  staffProfilesByClerkUserId: AdminStaffProfilesByClerkUserId;
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
        className="flex w-full flex-col gap-2 border-b border-border bg-muted p-3 text-left transition-colors hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
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
              warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
            })}
          </StatusBadge>
          <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
            {open ? "Hide product" : "Show product"}
          </span>
        </span>
      </button>
      {open ? (
        <>
      <div className="grid gap-4 border-b border-border bg-muted p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
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
                warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
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
            <div>
              <dt className="text-xs text-muted-foreground">Updated by</dt>
              <dd>
                <AdminUpdatedByCell
                  clerkUserId={resolveOrderLineUpdatedByClerkUserId(row.orderItem)}
                  profilesByClerkUserId={staffProfilesByClerkUserId}
                />
              </dd>
            </div>
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
      </ToggleSection>
        </>
      ) : null}
    </article>
  );
}

function historyLineMatchesQuery(
  row: AdminPaidOrderLineRow,
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

export function AdminOrderHistoryTimeline({
  rows,
  snapshotsByRequestId = {},
  orderContainerLinesByOrderId = {},
  staffProfilesByClerkUserId = {},
}: {
  rows: AdminPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  orderContainerLinesByOrderId?: Record<string, OrderContainerLineAdmin[]>;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const baseId = useId();
  const { setNestedPanelActive } = useAdminNestedPanelFocus();
  const [openCustomerKey, setOpenCustomerKey] = useState<string | null>(null);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] = useState<10 | 5 | 25 | 50>(10);
  const [linePage, setLinePage] = useState(1);

  const customerGroups = groupRowsByCustomer(rows);
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

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No product history records on this page.
      </p>
    );
  }

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
            } else if (activeCustomerKey === customerGroup.key) {
              setOpenCustomerKey(null);
            }
          }}
          defaultOpen={false}
          title={
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Customer</span>
              <AdminCustomerRecordLabel
                clerkUserId={customerGroup.key}
                fullName={customerGroup.fullName}
                email={customerGroup.email}
                primaryClassName="text-sm font-medium text-primary"
              />
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
                      className="bg-card"
                      bodyClassName="space-y-3"
                    >
                      {bucket.lines.map((row) => (
                        <ProductHistoryCard
                          key={row.orderItem.id}
                          row={row}
                          snapshots={snapshotsByRequestId[row.request.id] ?? []}
                          staffProfilesByClerkUserId={staffProfilesByClerkUserId}
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
                    className="bg-card"
                    bodyClassName="space-y-2"
                  >
                    {containerLines.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-border/80 bg-muted px-3 py-2 text-sm"
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
        );
      })}
    </div>
  );
}
