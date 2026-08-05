"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

import { getOrderPaidTopupAddOnTotalAction } from "@/actions/dashboard-checkout-charge-preview";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { AdminBatchHeaderOps } from "@/components/admin/admin-batch-header-ops";
import { AdminOrderLineActions } from "@/components/admin/admin-order-line-actions";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminPaidOrderLineRow } from "@/data/admin-order-lines";
import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import type {
  BatchQuoteEstimate,
  ItemQuote,
  ItemRequestLineSnapshot,
} from "@/db/schema";
import { adminCustomerDisplayLabel } from "@/lib/admin-customer-group";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { resolveOrderLineUpdatedByClerkUserId } from "@/lib/admin-staff-profiles";
import type { AdminOrderSlideGroup } from "@/lib/admin-orders-slide-filters";
import { formatUsd } from "@/lib/admin-markup";
import {
  alignBatchShareToChargedCents,
  computeBatchLineShares,
  type BatchLineShare,
} from "@/lib/batch-line-share";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { effectiveOutsidePurchasePaidFulfillment } from "@/lib/outside-purchase-order-fulfillment";
import { partitionPaidLinesIntoBatchBuckets } from "@/lib/partition-paid-order-batch-groups";
import { displaySiteName } from "@/lib/site-name";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { cn } from "@/lib/utils";

function quotedMerchandiseCostCents(
  latestQuotesByRequestId: Record<string, ItemQuote>,
  requestId: string,
): number | null {
  return latestQuotesByRequestId[requestId]?.itemCost ?? null;
}

function shortOrderId(orderId: string): string {
  return `${orderId.slice(0, 8)}…`;
}

function DetailProductCard({
  row,
  snapshotsByRequestId,
  latestQuotesByRequestId,
  staffProfilesByClerkUserId,
  batchShare,
  inBatchGroup,
}: {
  row: AdminPaidOrderLineRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  latestQuotesByRequestId: Record<string, ItemQuote>;
  staffProfilesByClerkUserId: AdminStaffProfilesByClerkUserId;
  batchShare?: BatchLineShare | null;
  inBatchGroup?: boolean;
}) {
  const r = row.request;
  const fulfillment = effectiveOutsidePurchasePaidFulfillment(
    r,
    row.orderItem,
    row.order,
  );
  const outsidePurchasePaidServiceFee =
    fulfillment === BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID;
  const isOutsidePurchase = isOutsidePurchaseRequest(r);
  const pendingProductReturn = row.pendingProductReturnRequest != null;
  const updatedByClerkUserId = resolveOrderLineUpdatedByClerkUserId(
    row.orderItem,
  );

  const purchaseReviewContext =
    fulfillment === "paid_pending_company_purchase" ?
      {
        retailerLabel: displaySiteName(r.siteName, r.productUrl),
        productUrl: r.productUrl,
        quotedMerchandiseCostCents: quotedMerchandiseCostCents(
          latestQuotesByRequestId,
          r.id,
        ),
        productLabel: r.productName?.trim() || "Item",
        quantity: row.orderItem.quantity,
        sizeLabel: r.productSize?.trim() ?? null,
        colorLabel: r.productColor?.trim() ?? null,
        batchLabel:
          row.resolvedBatchNumber?.trim() ||
          (row.resolvedBatchSessionId?.trim() ?
            `${row.resolvedBatchSessionId.trim().slice(0, 8)}…`
          : null),
        orderId: row.order.id,
        batchSessionId: row.resolvedBatchSessionId?.trim() || null,
        batchShare: batchShare ?? null,
        quote: latestQuotesByRequestId[r.id] ?? null,
      }
    : null;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background px-3.5 py-3 sm:flex-row sm:items-start sm:gap-4">
      <ProductRequestThumbnail
        variant="admin"
        imageUrl={r.productImageUrl}
        productLabel={r.productName}
        className="shrink-0"
      />

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold leading-snug text-foreground">
              {r.productName?.trim() || "Unnamed"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {displaySiteName(r.siteName, r.productUrl)}
              <span className="mx-1.5 text-border">·</span>
              <Link
                href={r.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Open product
              </Link>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">
              {formatUsd(row.orderItem.price)}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              Qty {row.orderItem.quantity}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
              pendingRefundRequest: row.pendingRefundRequest != null,
              pendingProductReturnRequest: pendingProductReturn,
              fulfillmentOverride: fulfillment,
            })}
            title={fulfillment}
          >
            {adminOrderLineStatusLabel(fulfillment, {
              pendingRefundRequest: row.pendingRefundRequest != null,
              pendingProductReturnRequest: pendingProductReturn,
              fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
              refundedCents: row.refundedCents,
              linePriceCents: row.orderItem.price,
              warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
            })}
          </StatusBadge>
          {updatedByClerkUserId ?
            <span className="inline-flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">Updated by</span>
              <AdminUpdatedByCell
                clerkUserId={updatedByClerkUserId}
                profilesByClerkUserId={staffProfilesByClerkUserId}
                primaryClassName="text-xs font-medium"
                secondaryClassName="hidden"
              />
            </span>
          : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2.5">
          {!outsidePurchasePaidServiceFee &&
          !(
            inBatchGroup &&
            fulfillment === "paid_pending_company_purchase" &&
            !row.pendingRefundRequest
          ) ?
            <AdminOrderLineActions
              orderItemId={row.orderItem.id}
              fulfillmentStatus={fulfillment}
              linePriceCents={row.orderItem.price}
              refundedCents={row.refundedCents}
              productLabel={r.productName?.trim() || "Item"}
              orderNumber={row.order.id}
              batchNumber={row.resolvedBatchNumber}
              batchSessionId={row.resolvedBatchSessionId}
              purchaseReviewContext={purchaseReviewContext}
              purchaseTracking={{
                trackingUrl: row.orderItem.companyPurchaseTrackingUrl,
                retailerTrackingCompany:
                  row.orderItem.companyPurchaseRetailerTrackingCompany,
                retailerTrackingNumber:
                  row.orderItem.companyPurchaseRetailerTrackingNumber,
              }}
              retailerReceiptImageUrls={
                row.orderItem.companyPurchaseReceiptImageUrls
              }
              pendingRefundRequest={row.pendingRefundRequest}
              pendingProductReturnRequest={row.pendingProductReturnRequest}
              fulfilledProductReturnRequest={row.fulfilledProductReturnRequest}
              isOutsidePurchase={isOutsidePurchase}
              inBatchGroup={inBatchGroup}
            />
          : null}
          <ItemRequestLineAuditDialog
            itemRequestId={r.id}
            productLabel={r.productName?.trim() || ""}
            snapshots={snapshotsByRequestId[r.id] ?? []}
            triggerLabel="Audit"
          />
        </div>
      </div>
    </article>
  );
}

function orderDetailLineMatchesQuery(
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

export function AdminOrderLinesDetailDialog({
  open,
  onOpenChange,
  group,
  snapshotsByRequestId = {},
  latestQuotesByRequestId = {},
  batchEstimatesBySessionId = {},
  orderContainerLinesByOrderId = {},
  staffProfilesByClerkUserId = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: AdminOrderSlideGroup | null;
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  latestQuotesByRequestId?: Record<string, ItemQuote>;
  batchEstimatesBySessionId?: Record<string, BatchQuoteEstimate>;
  orderContainerLinesByOrderId?: Record<string, OrderContainerLineAdmin[]>;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const baseId = useId();
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] = useState<10 | 5 | 25 | 50>(10);
  const [linePage, setLinePage] = useState(1);
  const [paidTopupCents, setPaidTopupCents] = useState(0);
  const [, startTopupTransition] = useTransition();

  useEffect(() => {
    if (!open || !group) {
      setPaidTopupCents(0);
      return;
    }
    const orderId = group.order.id;
    startTopupTransition(async () => {
      const res = await getOrderPaidTopupAddOnTotalAction({ orderId });
      if (res.ok) {
        setPaidTopupCents(res.paidTopupCents);
      } else {
        setPaidTopupCents(0);
      }
    });
  }, [open, group?.order.id]);

  const groupLines = group?.lines ?? [];
  const searchNorm = lineSearch.trim().toLowerCase();
  const filteredLines = useMemo(
    () =>
      groupLines.filter((row) => orderDetailLineMatchesQuery(row, searchNorm)),
    [groupLines, searchNorm],
  );
  const lineCount = filteredLines.length;
  const lineTotalPages = Math.max(1, Math.ceil(lineCount / linePageSize));
  const linePageSafe = Math.min(Math.max(1, linePage), lineTotalPages);
  const lineStart = (linePageSafe - 1) * linePageSize;
  const pagedLines = filteredLines.slice(lineStart, lineStart + linePageSize);
  const pagedBuckets = partitionPaidLinesIntoBatchBuckets(pagedLines);
  const batchShareByRequestId = useMemo(() => {
    const out: Record<string, BatchLineShare> = {};
    const buckets = partitionPaidLinesIntoBatchBuckets(groupLines);
    for (const bucket of buckets) {
      if (bucket.kind !== "batch") continue;
      const estimate = batchEstimatesBySessionId[bucket.batchSessionId];
      if (!estimate) continue;
      const lineIds = bucket.lines.map((l) => l.request.id);
      const shares = computeBatchLineShares(
        estimate,
        lineIds,
        (id) => latestQuotesByRequestId[id] ?? null,
      );
      for (const line of bucket.lines) {
        const share = shares.get(line.request.id);
        if (!share) continue;
        out[line.request.id] = alignBatchShareToChargedCents(
          share,
          line.orderItem.price,
        );
      }
    }
    return out;
  }, [groupLines, batchEstimatesBySessionId, latestQuotesByRequestId]);
  const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
  const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

  if (!group) return null;

  const first = group.lines[0]!;
  const customer = adminCustomerDisplayLabel({
    fullName: first.customerFullName,
    email: first.customerEmail,
    clerkUserId: group.order.clerkUserId,
  });
  const containerLines = orderContainerLinesByOrderId[group.order.id] ?? [];
  const checkoutTotalCents = group.order.totalAmount;
  const adjustedOrderTotalCents = checkoutTotalCents + paidTopupCents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[min(96vw,42rem)] max-w-[min(96vw,42rem)] flex-col gap-0 overflow-hidden p-0",
          "max-h-[min(92vh,56rem)] sm:max-w-[min(96vw,42rem)]",
        )}
      >
        <DialogHeader className="shrink-0 gap-3 border-b border-border bg-muted/80 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-left text-lg tracking-tight">
                Order products
              </DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">
                Products on this paid order, grouped by batch and singles.
              </DialogDescription>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {paidTopupCents > 0 ? "New total" : "Order total"}
              </span>
              <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatUsd(adjustedOrderTotalCents)}
              </span>
              {paidTopupCents > 0 ?
                <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-muted-foreground">
                  Checkout {formatUsd(checkoutTotalCents)}
                  {" + "}
                  top-ups {formatUsd(paidTopupCents)}
                </p>
              : null}
            </div>
          </div>

          <dl className="grid gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm sm:grid-cols-3">
            <div className="min-w-0 space-y-0.5 sm:col-span-1">
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Customer
              </dt>
              <dd className="truncate font-medium text-foreground" title={customer}>
                {customer}
              </dd>
            </div>
            <div className="min-w-0 space-y-0.5">
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Order id
              </dt>
              <dd
                className="font-mono text-xs tabular-nums text-foreground"
                title={group.order.id}
              >
                {shortOrderId(group.order.id)}
              </dd>
            </div>
            <div className="min-w-0 space-y-0.5">
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Checkout date & time
              </dt>
              <dd className="text-xs tabular-nums text-foreground">
                <time dateTime={group.order.createdAt}>
                  {new Date(group.order.createdAt).toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <AdminNestedFindOrganizePanel
            switchId={`${baseId}-line-find-organize`}
            searchInputId={`${baseId}-line-search`}
            pageSizeSelectId={`${baseId}-line-page-size`}
            visible={lineFindOrganizeVisible}
            onVisibleChange={setLineFindOrganizeVisible}
            search={lineSearch}
            onSearchChange={(value) => {
              setLineSearch(value);
              setLinePage(1);
            }}
            searchLabel="Search order lines"
            searchPlaceholder="Product, URL, request id, line id, batch…"
            pageSize={linePageSize}
            onPageSizeChange={(size) => {
              setLinePageSize(size);
              setLinePage(1);
            }}
            pageSizeLabel="Lines per page"
            showFrom={lineShowFrom}
            showTo={lineShowTo}
            totalCount={lineCount}
            totalLoaded={group.lines.length}
            itemLabel="product line"
            emptyMessage="No product lines on this order."
            noMatchMessage="No product lines match the current search."
            className="mb-4"
          />

          <div className="space-y-4">
            {pagedBuckets.map((bucket, bi) => {
              if (bucket.kind === "batch") {
                const batchEstimate =
                  batchEstimatesBySessionId[bucket.batchSessionId] ?? null;
                const batchLabel =
                  bucket.batchNumber ??
                  `${bucket.batchSessionId.slice(0, 8)}…`;
                return (
                  <section
                    key={bucket.batchSessionId}
                    className="overflow-hidden rounded-2xl border border-border/80 bg-muted/25 ring-1 ring-border/30"
                  >
                    <header className="space-y-2.5 border-b border-border/60 bg-muted/50 px-3.5 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Batch
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            <span className="font-mono text-primary">
                              {batchLabel}
                            </span>
                            <span className="mx-1.5 font-normal text-muted-foreground">
                              ·
                            </span>
                            <span className="font-normal text-muted-foreground">
                              {bucket.lines.length}{" "}
                              {bucket.lines.length === 1 ? "product" : "products"}
                            </span>
                          </p>
                          {batchEstimate ?
                            <p className="text-xs text-muted-foreground">
                              Estimate on file
                            </p>
                          : null}
                        </div>
                        <AdminBatchHeaderOps
                          orderId={group.order.id}
                          batchSessionId={bucket.batchSessionId}
                          batchNumber={bucket.batchNumber}
                          lines={bucket.lines}
                          batchShareByRequestId={batchShareByRequestId}
                          batchEstimate={batchEstimate}
                        />
                      </div>
                    </header>
                    <div className="space-y-2.5 p-3">
                      {bucket.lines.map((row) => (
                        <DetailProductCard
                          key={row.orderItem.id}
                          row={row}
                          snapshotsByRequestId={snapshotsByRequestId}
                          latestQuotesByRequestId={latestQuotesByRequestId}
                          staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                          batchShare={
                            batchShareByRequestId[row.request.id] ?? null
                          }
                          inBatchGroup
                        />
                      ))}
                    </div>
                  </section>
                );
              }

              return (
                <section
                  key={`single:${group.order.id}:${bi}`}
                  className="overflow-hidden rounded-2xl border border-border/80 bg-muted/25 ring-1 ring-border/30"
                >
                  <header className="border-b border-border/60 bg-muted/50 px-3.5 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Single {bucket.lines.length === 1 ? "product" : "products"}
                    </p>
                  </header>
                  <div className="space-y-2.5 p-3">
                    {bucket.lines.map((row) => (
                      <DetailProductCard
                        key={row.orderItem.id}
                        row={row}
                        snapshotsByRequestId={snapshotsByRequestId}
                        latestQuotesByRequestId={latestQuotesByRequestId}
                        staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                        batchShare={
                          batchShareByRequestId[row.request.id] ?? null
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {containerLines.length > 0 ?
              <section className="overflow-hidden rounded-2xl border border-border/80 bg-muted/25 ring-1 ring-border/30">
                <header className="border-b border-border/60 bg-muted/50 px-3.5 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Shipping containers
                  </p>
                </header>
                <ul className="space-y-2.5 p-3" role="list">
                  {containerLines.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3.5 py-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {c.nameSnapshot}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Checkout merchandise
                          <span className="mx-1.5 text-border">·</span>
                          Qty {c.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                        {formatUsd(c.lineTotalCents)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            : null}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Full order history also on{" "}
            <Link
              href="/admin/orders-history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Orders history
            </Link>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
