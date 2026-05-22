"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type { ReactNode } from "react";
import Link from "next/link";

import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { CollapsibleOrderBatchBucket } from "@/components/orders/collapsible-order-batch-bucket";
import { CollapsibleOrderTableSection } from "@/components/orders/collapsible-order-table-section";
import { PaidOrderAccordionRoot } from "@/components/orders/paid-order-accordion";
import { DashboardOrderLineTracking } from "@/components/dashboard/dashboard-order-line-tracking";
import { DashboardCheckoutChargesPreviewDialog } from "@/components/dashboard/dashboard-checkout-charges-preview-dialog";
import { DashboardProductReturnPreviewDialog } from "@/components/dashboard/dashboard-product-return-preview-dialog";
import { DashboardStripeRefundReceiptLinks } from "@/components/dashboard/dashboard-stripe-refund-receipt-links";
import { DashboardAcceptDeliveryConditionDialog } from "@/components/dashboard/dashboard-accept-delivery-condition-dialog";
import { DashboardProductReturnRequestDialog } from "@/components/dashboard/dashboard-product-return-request-dialog";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import type { OrderListCore } from "@/data/order-list-select";
import { formatUsd } from "@/lib/admin-markup";
import {
  deliveryConditionAcceptedAwaitingBarrelLabel,
  isDeliveryConditionAcceptedForBarrel,
  isProblemDeliveryReceiptFulfillment,
  problemDeliveryWarehouseCondition,
} from "@/lib/delivery-condition-acceptance";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import {
  groupPaidRowsStableByOrder,
  partitionPaidLinesIntoBatchBuckets,
} from "@/lib/partition-paid-order-batch-groups";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { displaySiteName } from "@/lib/site-name";

function subgroupColSpan(): number {
  return 12;
}

function dashboardShowLineTracking(row: DashboardPaidOrderLineRow): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const oi = row.orderItem;
  if (fulfillment === "company_purchase_pending_delivery") return true;
  if (fulfillment === "delivery_requested_pending_fulfillment") return true;
  if (
    fulfillment === "delivery_received_item_missing" ||
    fulfillment === "delivery_received_item_damaged" ||
    fulfillment === "delivery_received_wrong_item"
  ) {
    return true;
  }
  if (fulfillment === "delivery_received_good_awaiting_barrel") {
    return !!(
      oi.companyPurchaseTrackingUrl?.trim() ||
      oi.companyPurchaseRetailerTrackingNumber?.trim() ||
      oi.companyPurchaseRetailerTrackingCompany?.trim()
    );
  }
  if (fulfillment === "product_return_awaiting_delivery") return true;
  return false;
}

export function DashboardPaidOrdersTable({
  rows,
  snapshotsByRequestId = {},
  orderAccordionResetKey,
}: {
  rows: DashboardPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  orderAccordionResetKey: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No orders on this page.
      </p>
    );
  }

  const orderGroups = groupPaidRowsStableByOrder(rows);

  return (
    <div className="space-y-3">
      <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Product</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Site</th>
              <th className="px-3 py-2.5 font-medium text-foreground">URL</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Qty</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Line total</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Refunded</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Fulfillment</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                Tracking
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">Refund</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Audit</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Checked out</th>
            </tr>
          </thead>
          <PaidOrderAccordionRoot
            resetKey={orderAccordionResetKey}
            initialExpandedOrderId={orderGroups[0]?.order.id ?? null}
          >
            {orderGroups.map(({ order, lines }) => (
              <OrderBlock
                key={order.id}
                order={order}
                lines={lines}
                snapshotsByRequestId={snapshotsByRequestId}
              />
            ))}
          </PaidOrderAccordionRoot>
        </table>
      </FloatingHorizontalScroll>
    </div>
  );
}

function OrderBlock({
  order,
  lines,
  snapshotsByRequestId,
}: {
  order: OrderListCore;
  lines: DashboardPaidOrderLineRow[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
}) {
  const buckets = partitionPaidLinesIntoBatchBuckets(lines);
  const hasBatchMix = buckets.some((b) => b.kind === "batch");
  const hasSinglesMix = buckets.some((b) => b.kind === "single");
  const onlySinglesSubgroup = buckets.length === 1 && buckets[0]!.kind === "single";

  const lineCount = lines.length;

  return (
    <CollapsibleOrderTableSection
      orderId={order.id}
      colSpan={subgroupColSpan()}
      lineCount={lineCount}
      summaryContent={
        <>
          <span className="min-w-0 font-medium text-foreground">
            Order{" "}
            <span className="inline-block font-mono text-xs leading-snug text-primary break-all">
              {order.id}
            </span>
          </span>
          <span className="inline-flex items-center rounded-full border border-border/80 bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-foreground">
            Order {order.status}
          </span>
          <span className="tabular-nums text-foreground">
            Total {formatUsd(order.totalAmount)}
          </span>
          <span className="tabular-nums">
            <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString()}</time>
          </span>
          <span className="hidden text-muted-foreground sm:inline">
            · {lineCount === 1 ? "1 line" : `${lineCount} lines`}
          </span>
          <DashboardCheckoutChargesPreviewDialog
            scope="order"
            orderId={order.id}
            triggerLabel="Preview checkout charges"
          />
        </>
      }
    >
      {onlySinglesSubgroup ?
        buckets[0]!.lines.map((row) => (
          <DashboardOrderDataRow
            key={row.orderItem.id}
            row={row}
            snapshotsByRequestId={snapshotsByRequestId}
          />
        ))
      : buckets.map((bucket, bi) => {
          if (bucket.kind === "batch") {
            return (
              <CollapsibleOrderBatchBucket
                key={bucket.batchSessionId}
                colSpan={subgroupColSpan()}
                title={
                  <>
                    Batch{" "}
                    <span className="font-mono text-xs text-primary">
                      {bucket.batchNumber ?? bucket.batchSessionId.slice(0, 8) + "…"}
                    </span>
                    {" · "}
                    {bucket.lines.length}{" "}
                    {bucket.lines.length === 1 ? "product" : "products"}
                  </>
                }
                trailing={
                  <DashboardCheckoutChargesPreviewDialog
                    scope="batch"
                    orderId={order.id}
                    batchSessionId={bucket.batchSessionId}
                    triggerLabel="Preview batch charges"
                  />
                }
              >
                {bucket.lines.map((row) => (
                  <DashboardOrderDataRow
                    key={row.orderItem.id}
                    row={row}
                    snapshotsByRequestId={snapshotsByRequestId}
                  />
                ))}
              </CollapsibleOrderBatchBucket>
            );
          }
          return (
            <CollapsibleOrderBatchBucket
              key={`single:${order.id}:${bi}`}
              colSpan={subgroupColSpan()}
              title={hasBatchMix && hasSinglesMix ? "Single items" : "Single"}
              muted={!(hasBatchMix && hasSinglesMix)}
            >
              {bucket.lines.map((row) => (
                <DashboardOrderDataRow
                  key={row.orderItem.id}
                  row={row}
                  snapshotsByRequestId={snapshotsByRequestId}
                />
              ))}
            </CollapsibleOrderBatchBucket>
          );
        })
      }
    </CollapsibleOrderTableSection>
  );
}

function DashboardRefundPreviewDialog({ row }: { row: DashboardPaidOrderLineRow }) {
  if (row.refundedCents <= 0) return null;

  const r = row.request;
  const productName = r.productName?.trim() || "Unnamed product";
  const productNumber = row.orderItem.id;
  const batchDisplay =
    row.resolvedBatchNumber?.trim()
      ? row.resolvedBatchNumber.trim()
      : row.resolvedBatchSessionId?.trim()
        ? `Session ${row.resolvedBatchSessionId.trim().slice(0, 8)}…`
        : null;
  const size = r.productSize?.trim();
  const color = r.productColor?.trim();

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground shadow-xs transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Preview refund
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund preview</DialogTitle>
          <DialogDescription>
            Refund details recorded for this product line after approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <dl className="grid gap-3 text-foreground">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Product name
                </dt>
                <dd className="mt-0.5 font-medium leading-snug">{productName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Product number
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs" title={productNumber}>
                  {productNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Order number
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs" title={row.order.id}>
                  {row.order.id}
                </dd>
              </div>
              {batchDisplay ?
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Batch
                  </dt>
                  <dd className="mt-0.5 font-medium">{batchDisplay}</dd>
                  {row.resolvedBatchSessionId?.trim() && row.resolvedBatchNumber?.trim() ?
                    <dd
                      className="mt-1 break-all font-mono text-[10px] text-muted-foreground"
                      title={row.resolvedBatchSessionId.trim()}
                    >
                      ID {row.resolvedBatchSessionId.trim()}
                    </dd>
                  : null}
                </div>
              : null}
            </dl>
          </div>

          <div className="grid gap-3 rounded-lg border border-border bg-background p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quantity
              </p>
              <p className="mt-0.5 tabular-nums text-foreground">
                {row.orderItem.quantity}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Size
              </p>
              <p className="mt-0.5 text-foreground">{size || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Color
              </p>
              <p className="mt-0.5 text-foreground">{color || "—"}</p>
            </div>
          </div>

          <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.08] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-900 dark:text-violet-200">
              Total refunded
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatUsd(row.refundedCents)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Approval history
            </p>
            {row.refundDetails.length > 0 ?
              <div className="divide-y divide-border rounded-lg border border-border">
                {row.refundDetails.map((refund, i) => (
                  <div key={refund.id} className="space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium tabular-nums text-foreground">
                        {formatUsd(refund.amountCents)}
                      </p>
                      <time
                        dateTime={refund.createdAt}
                        className="text-xs text-muted-foreground"
                      >
                        {new Date(refund.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Approved refund {i + 1}
                      {refund.stripeRefundId ?
                        <>
                          {" · "}
                          <span className="font-mono">{refund.stripeRefundId}</span>
                        </>
                      : null}
                    </p>
                  </div>
                ))}
              </div>
            : (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Refund total is recorded, but detailed refund rows were not available.
              </p>
            )}
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function DashboardOrderDataRow(props: {
  row: DashboardPaidOrderLineRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
}) {
  const { row, snapshotsByRequestId } = props;
  const r = row.request;
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const pendingRefund = row.pendingRefundRequest != null;
  const pendingReturn = row.pendingProductReturnRequest != null;
  const fulfilledReturn = row.fulfilledProductReturnRequest != null;
  const isOutside = isOutsidePurchaseRequest(r);
  const showTracking =
    !pendingReturn && fulfillment !== "product_return_awaiting_delivery" &&
    dashboardShowLineTracking(row);
  const returnWorkflowActive =
    pendingReturn ||
    fulfilledReturn ||
    fulfillment === "product_return_awaiting_delivery";

  const problemWarehouseCondition = isProblemDeliveryReceiptFulfillment(fulfillment) ?
    problemDeliveryWarehouseCondition(
      fulfillment,
      row.orderItem.warehouseReceivedCondition,
    )
  : null;
  const lineStatusLabelOpts = {
    pendingRefundRequest: pendingRefund,
    pendingProductReturnRequest: pendingReturn,
    fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
    refundedCents: row.refundedCents,
    linePriceCents: row.orderItem.price,
    warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
  };
  const acceptedAwaitingBarrelLabel = deliveryConditionAcceptedAwaitingBarrelLabel(
    row.orderItem.warehouseReceivedCondition,
  );
  const statusBadgeTitle =
    problemWarehouseCondition ?
      `Received condition: ${warehouseReceiveConditionLabel(problemWarehouseCondition)}`
    : isDeliveryConditionAcceptedForBarrel(
          fulfillment,
          row.orderItem.warehouseReceivedCondition,
        ) && acceptedAwaitingBarrelLabel ?
      acceptedAwaitingBarrelLabel
    : pendingRefund || pendingReturn ?
      undefined
    : dashboardOrderLineStatusLabel(fulfillment, lineStatusLabelOpts);

  return (
    <tr className="align-top">
      <td className="px-3 py-3 align-top">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={r.productImageUrl}
          productLabel={r.productName}
        />
      </td>
      <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
        <span className="line-clamp-2">{r.productName?.trim() || "Unnamed product"}</span>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground" title={r.id}>
          Req {r.id.slice(0, 8)}…
        </p>
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
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">{row.orderItem.quantity}</td>
      <td className="px-3 py-3 align-top font-medium tabular-nums text-foreground">
        {formatUsd(row.orderItem.price)}
      </td>
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">
        {row.refundedCents > 0 ?
          <>
            {formatUsd(row.refundedCents)}
            {row.refundedCents < row.orderItem.price ?
              <span className="mt-0.5 block text-xs">
                Net {formatUsd(row.orderItem.price - row.refundedCents)}
              </span>
            : null}
          </>
        : "—"}
      </td>
      <td className="max-w-[14rem] px-3 py-3 align-top">
        <StatusBadge
          kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
            pendingRefundRequest: pendingRefund,
            pendingProductReturnRequest: pendingReturn,
          })}
          title={statusBadgeTitle}
        >
          {dashboardOrderLineStatusLabel(fulfillment, lineStatusLabelOpts)}
        </StatusBadge>
      </td>
      <td className="px-3 py-3 align-top">
        {showTracking ?
          <DashboardOrderLineTracking
            trackingUrl={row.orderItem.companyPurchaseTrackingUrl}
            retailerCompany={row.orderItem.companyPurchaseRetailerTrackingCompany}
            trackingNumber={row.orderItem.companyPurchaseRetailerTrackingNumber}
            productLabel={r.productName?.trim() || "Item"}
          />
        : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {returnWorkflowActive && !isOutside ?
          <>
            <DashboardProductReturnPreviewDialog row={row} />
            <DashboardStripeRefundReceiptLinks refunds={row.refundDetails} />
          </>
        : !isOutside ?
          <>
            <DashboardRefundPreviewDialog row={row} />
            <DashboardProductReturnRequestDialog row={row} />
            <DashboardStripeRefundReceiptLinks refunds={row.refundDetails} />
          </>
        : (
          <>
            <DashboardRefundPreviewDialog row={row} />
            <DashboardStripeRefundReceiptLinks refunds={row.refundDetails} />
          </>
        )}
        {row.pendingRefundRequest ?
          <p className="mt-2 text-[10px] font-medium text-amber-900 dark:text-amber-100">
            Awaiting staff approval
          </p>
        : null}
        <DashboardAcceptDeliveryConditionDialog row={row} />
      </td>
      <td className="px-3 py-3 align-top">
        <ItemRequestLineAuditDialog
          itemRequestId={r.id}
          productLabel={r.productName?.trim() || ""}
          snapshots={snapshotsByRequestId[r.id] ?? []}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
        <time dateTime={row.order.createdAt}>{new Date(row.order.createdAt).toLocaleString()}</time>
      </td>
    </tr>
  );
}
