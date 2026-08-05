"use client";

import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { getOrderPaidTopupAddOnTotalAction } from "@/actions/dashboard-checkout-charge-preview";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { DashboardAcceptDeliveryConditionDialog } from "@/components/dashboard/dashboard-accept-delivery-condition-dialog";
import { DashboardCheckoutChargesPreviewDialog } from "@/components/dashboard/dashboard-checkout-charges-preview-dialog";
import { DashboardOrderLineTracking } from "@/components/dashboard/dashboard-order-line-tracking";
import { DashboardProductReturnPreviewDialog } from "@/components/dashboard/dashboard-product-return-preview-dialog";
import { DashboardProductReturnRequestDialog } from "@/components/dashboard/dashboard-product-return-request-dialog";
import {
  DashboardRefundPreviewDialog,
} from "@/components/dashboard/dashboard-paid-orders-table";
import { DashboardStripeRefundReceiptLinks } from "@/components/dashboard/dashboard-stripe-refund-receipt-links";
import { WarehouseIntakePreviewDialog } from "@/components/orders/warehouse-intake-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import type { OrderSlideGroup } from "@/lib/admin-orders-slide-filters";
import { formatUsd } from "@/lib/admin-markup";
import {
  deliveryConditionAcceptedAwaitingBarrelLabel,
  isDeliveryConditionAcceptedForBarrel,
  isProblemDeliveryReceiptFulfillment,
  problemDeliveryWarehouseCondition,
} from "@/lib/delivery-condition-acceptance";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { partitionPaidLinesIntoBatchBuckets } from "@/lib/partition-paid-order-batch-groups";
import { displaySiteName } from "@/lib/site-name";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import { cn } from "@/lib/utils";

function shortOrderId(orderId: string): string {
  return `${orderId.slice(0, 8)}…`;
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

function DashboardOrderProductCard({
  row,
  snapshotsByRequestId,
  inBatchGroup,
}: {
  row: DashboardPaidOrderLineRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  inBatchGroup?: boolean;
}) {
  const r = row.request;
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const pendingRefund = row.pendingRefundRequest != null;
  const pendingReturn = row.pendingProductReturnRequest != null;
  const fulfilledReturn = row.fulfilledProductReturnRequest != null;
  const isOutside = isOutsidePurchaseRequest(r);
  const showTracking =
    !pendingReturn &&
    fulfillment !== "product_return_awaiting_delivery" &&
    dashboardShowLineTracking(row);
  const returnWorkflowActive =
    pendingReturn ||
    fulfilledReturn ||
    fulfillment === "product_return_awaiting_delivery";

  const problemWarehouseCondition =
    isProblemDeliveryReceiptFulfillment(fulfillment) ?
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
    companyPurchaseInboundMethod: row.orderItem.companyPurchaseInboundMethod,
  };
  const acceptedAwaitingBarrelLabel =
    deliveryConditionAcceptedAwaitingBarrelLabel(
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
              {r.productName?.trim() || "Unnamed product"}
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
            {row.refundedCents > 0 ?
              <p className="text-xs text-muted-foreground">
                Refunded {formatUsd(row.refundedCents)}
                {row.refundedCents < row.orderItem.price ?
                  <span>
                    {" · "}Net{" "}
                    {formatUsd(row.orderItem.price - row.refundedCents)}
                  </span>
                : null}
              </p>
            : null}
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
              pendingRefundRequest: pendingRefund,
              pendingProductReturnRequest: pendingReturn,
            })}
            title={statusBadgeTitle}
          >
            {dashboardOrderLineStatusLabel(fulfillment, lineStatusLabelOpts)}
          </StatusBadge>
          {showTracking ?
            <DashboardOrderLineTracking
              trackingUrl={row.orderItem.companyPurchaseTrackingUrl}
              retailerCompany={
                row.orderItem.companyPurchaseRetailerTrackingCompany
              }
              trackingNumber={
                row.orderItem.companyPurchaseRetailerTrackingNumber
              }
              productLabel={r.productName?.trim() || "Item"}
            />
          : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2.5">
          {!inBatchGroup ?
            <DashboardCheckoutChargesPreviewDialog
              scope="line"
              orderId={row.order.id}
              orderItemId={row.orderItem.id}
              triggerLabel="Line charges"
            />
          : null}
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
          : <>
              <DashboardRefundPreviewDialog row={row} />
              <DashboardStripeRefundReceiptLinks refunds={row.refundDetails} />
            </>
          }
          {row.pendingRefundRequest ?
            <p className="text-[10px] font-medium text-amber-900 dark:text-amber-100">
              Awaiting staff approval
            </p>
          : null}
          <DashboardAcceptDeliveryConditionDialog row={row} />
          {fulfillment === "delivery_received_item_missing" &&
          row.orderItem.warehouseReceivedAt ?
            <WarehouseIntakePreviewDialog
              productLabel={r.productName?.trim() || "Unnamed product"}
              orderItem={row.orderItem}
              snapshots={snapshotsByRequestId[r.id] ?? []}
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
  const router = useRouter();
  const [refreshPending, startRefresh] = useTransition();
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
      setPaidTopupCents(res.ok ? res.paidTopupCents : 0);
    });
  }, [open, group?.order.id]);

  if (!group) return null;

  const buckets = partitionPaidLinesIntoBatchBuckets(group.lines);
  const checkoutTotalCents = group.order.totalAmount;
  const adjustedOrderTotalCents = checkoutTotalCents + paidTopupCents;

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

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

          <dl className="grid gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm sm:grid-cols-2">
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {buckets.map((bucket, bi) => {
            if (bucket.kind === "batch") {
              const batchLabel =
                bucket.batchNumber ??
                `${bucket.batchSessionId.slice(0, 8)}…`;
              return (
                <section
                  key={bucket.batchSessionId}
                  className="overflow-hidden rounded-2xl border border-border/80 bg-muted/25 ring-1 ring-border/30"
                >
                  <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 bg-muted/50 px-3.5 py-3">
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
                    </div>
                    <DashboardCheckoutChargesPreviewDialog
                      scope="batch"
                      orderId={group.order.id}
                      batchSessionId={bucket.batchSessionId}
                      triggerLabel="Batch charges"
                    />
                  </header>
                  <div className="space-y-2.5 p-3">
                    {bucket.lines.map((row) => (
                      <DashboardOrderProductCard
                        key={row.orderItem.id}
                        row={row}
                        snapshotsByRequestId={snapshotsByRequestId}
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
                    <DashboardOrderProductCard
                      key={row.orderItem.id}
                      row={row}
                      snapshotsByRequestId={snapshotsByRequestId}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <DashboardCheckoutChargesPreviewDialog
              scope="order"
              orderId={group.order.id}
              triggerLabel="Preview checkout charges"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshPending}
              aria-label="Refresh order products"
            >
              {refreshPending ?
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              : <RefreshCw className="size-3.5" aria-hidden />}
              Refresh
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
