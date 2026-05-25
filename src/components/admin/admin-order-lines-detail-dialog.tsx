"use client";

import Link from "next/link";
import { Fragment, useId, useMemo, useState } from "react";

import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";

import { AdminOrderEstimateSummary } from "@/components/admin/admin-order-estimate-summary";
import { AdminOrderLineActions } from "@/components/admin/admin-order-line-actions";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { resolveOrderLineUpdatedByClerkUserId } from "@/lib/admin-staff-profiles";
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
import {
  adminCustomerDisplayLabel,
} from "@/lib/admin-customer-group";
import { batchEstimateSummaryRows } from "@/lib/admin-order-estimate-summary-rows";
import type { AdminOrderSlideGroup } from "@/lib/admin-orders-slide-filters";
import { formatUsd } from "@/lib/admin-markup";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
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

function DetailLineRow({
  row,
  snapshotsByRequestId,
  latestQuotesByRequestId,
  staffProfilesByClerkUserId,
  inBatchGroup,
}: {
  row: AdminPaidOrderLineRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  latestQuotesByRequestId: Record<string, ItemQuote>;
  staffProfilesByClerkUserId: AdminStaffProfilesByClerkUserId;
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
  const pendingProductReturn = row.pendingProductReturnRequest != null;

  const purchaseReviewContext =
    fulfillment === "paid_pending_company_purchase" ?
      {
        retailerLabel: displaySiteName(r.siteName, r.productUrl),
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
      }
    : null;

  return (
    <tr className="align-top border-b border-border/80">
      <td className="px-3 py-2.5">
        <ProductRequestThumbnail
          variant="admin"
          imageUrl={r.productImageUrl}
          productLabel={r.productName}
        />
      </td>
      <td className="max-w-[9rem] px-3 py-2.5 text-xs text-muted-foreground">
        {inBatchGroup ?
          "Batch item"
        : row.resolvedBatchSessionId?.trim() ?
          "Batch bundle"
        : "Single"}
      </td>
      <td className="min-w-[10rem] max-w-[14rem] px-3 py-2.5 font-medium text-foreground">
        <span className="line-clamp-2">{r.productName?.trim() || "Unnamed"}</span>
        <p className="mt-1 text-xs text-muted-foreground">
          {displaySiteName(r.siteName, r.productUrl)}
        </p>
        <Link
          href={r.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Open product
        </Link>
      </td>
      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
        {row.orderItem.quantity}
      </td>
      <td className="px-3 py-2.5 font-medium tabular-nums">
        {formatUsd(row.orderItem.price)}
      </td>
      <td className="max-w-[10rem] px-3 py-2.5">
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
      </td>
      <td className="px-3 py-2.5">
        {outsidePurchasePaidServiceFee ?
          <span className="text-xs text-muted-foreground">—</span>
        : <AdminOrderLineActions
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
            retailerReceiptImageUrls={row.orderItem.companyPurchaseReceiptImageUrls}
            pendingRefundRequest={row.pendingRefundRequest}
            pendingProductReturnRequest={row.pendingProductReturnRequest}
            fulfilledProductReturnRequest={row.fulfilledProductReturnRequest}
          />
        }
      </td>
      <td className="min-w-[9rem] max-w-[11rem] px-3 py-2.5 align-top">
        <AdminUpdatedByCell
          clerkUserId={resolveOrderLineUpdatedByClerkUserId(row.orderItem)}
          profilesByClerkUserId={staffProfilesByClerkUserId}
        />
      </td>
      <td className="px-3 py-2.5">
        <ItemRequestLineAuditDialog
          itemRequestId={r.id}
          productLabel={r.productName?.trim() || ""}
          snapshots={snapshotsByRequestId[r.id] ?? []}
        />
      </td>
    </tr>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[min(96vw,80rem)] max-w-[min(96vw,80rem)] flex-col gap-0 overflow-hidden p-0",
          "max-h-[min(92vh,56rem)] sm:max-w-[min(96vw,80rem)]",
        )}
      >
        <DialogHeader className="shrink-0 gap-3 border-b border-border bg-muted px-4 py-4 sm:px-6">
          <DialogTitle className="text-left text-lg">Order products</DialogTitle>
          <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Customer
              </p>
              <p className="text-sm font-medium text-foreground">{customer}</p>
            </div>
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
                Paid / created
              </p>
              <p className="text-sm tabular-nums text-foreground">
                <time dateTime={group.order.createdAt}>
                  {new Date(group.order.createdAt).toLocaleString()}
                </time>
              </p>
            </div>
          </div>
          <DialogDescription className="text-left text-xs">
            Grouped by batch and single items. Scroll horizontally if columns extend
            past the edge.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
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
          <p className="mb-2 text-xs text-muted-foreground">
            ← Scroll inside the box below to see Photo, Group, Product, and other columns →
          </p>
          <div
            className={cn(
              "max-h-[min(58vh,40rem)] overflow-auto rounded-lg border border-border bg-background",
              "[scrollbar-color:var(--primary)_var(--muted)] [scrollbar-width:thin]",
              "[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/60 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted",
            )}
          >
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Photo
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Group
                  </th>
                  <th className="min-w-[10rem] whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Product
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Qty
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Line total
                  </th>
                  <th className="min-w-[9rem] whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Status
                  </th>
                  <th className="min-w-[8rem] whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Ops
                  </th>
                  <th className="min-w-[9rem] whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Updated by
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    Audit
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedBuckets.map((bucket, bi) => {
                  if (bucket.kind === "batch") {
                    const batchEstimate =
                      batchEstimatesBySessionId[bucket.batchSessionId] ?? null;
                    return (
                      <Fragment key={bucket.batchSessionId}>
                        <tr className="bg-muted">
                          <td
                            colSpan={9}
                            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                          >
                            Batch{" "}
                            <span className="font-mono text-primary">
                              {bucket.batchNumber ??
                                `${bucket.batchSessionId.slice(0, 8)}…`}
                            </span>
                            {" · "}
                            {bucket.lines.length}{" "}
                            {bucket.lines.length === 1 ? "product" : "products"}
                            {batchEstimate ?
                              <span className="ml-2 font-normal normal-case text-muted-foreground">
                                (estimate on file)
                              </span>
                            : null}
                          </td>
                        </tr>
                        {batchEstimate ?
                          <tr>
                            <td colSpan={9} className="bg-muted px-3 py-2">
                              <AdminOrderEstimateSummary
                                rows={batchEstimateSummaryRows(batchEstimate)}
                              />
                            </td>
                          </tr>
                        : null}
                        {bucket.lines.map((row) => (
                          <DetailLineRow
                            key={row.orderItem.id}
                            row={row}
                            snapshotsByRequestId={snapshotsByRequestId}
                            latestQuotesByRequestId={latestQuotesByRequestId}
                            staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                            inBatchGroup
                          />
                        ))}
                      </Fragment>
                    );
                  }
                  return (
                    <Fragment key={`single:${group.order.id}:${bi}`}>
                      <tr className="bg-muted">
                        <td
                          colSpan={9}
                          className={cn(
                            "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground",
                            pagedBuckets.length > 1 && "text-muted-foreground",
                          )}
                        >
                          Single {bucket.lines.length === 1 ? "product" : "products"}
                        </td>
                      </tr>
                      {bucket.lines.map((row) => (
                        <DetailLineRow
                          key={row.orderItem.id}
                          row={row}
                          snapshotsByRequestId={snapshotsByRequestId}
                          latestQuotesByRequestId={latestQuotesByRequestId}
                          staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                        />
                      ))}
                    </Fragment>
                  );
                })}
                {containerLines.length > 0 ?
                  <>
                    <tr className="bg-muted">
                      <td
                        colSpan={9}
                        className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Shipping containers
                      </td>
                    </tr>
                    {containerLines.map((c) => (
                      <tr key={c.id} className="border-b border-border/80">
                        <td className="px-3 py-2.5 text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-xs">Container</td>
                        <td className="px-3 py-2.5 font-medium">{c.nameSnapshot}</td>
                        <td className="px-3 py-2.5 tabular-nums">{c.quantity}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatUsd(c.lineTotalCents)}
                        </td>
                        <td colSpan={2} className="px-3 py-2.5 text-xs text-muted-foreground">
                          Checkout merchandise
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-muted-foreground">—</td>
                      </tr>
                    ))}
                  </>
                : null}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Full-width table also on{" "}
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
