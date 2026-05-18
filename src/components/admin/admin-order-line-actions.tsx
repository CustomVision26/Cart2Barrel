"use client";

import { AdminCompanyPurchaseDialog } from "@/components/admin/admin-company-purchase-dialog";
import {
  AdminPurchaseTrackingDialog,
  AdminPurchaseTrackingLink,
} from "@/components/admin/admin-purchase-tracking-dialog";
import { AdminRefundOrderLineButton } from "@/components/admin/admin-refund-order-line-button";
import { AdminRefundRequestControls } from "@/components/admin/admin-refund-request-controls";
import type { OrderItem } from "@/db/schema";
import type { PendingRefundRequestBrief } from "@/data/order-item-refund-requests";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";

/** Staff quote row `item_cost` plus display fields — used only for pending company purchase UI. */
export type AdminPurchaseReviewContext = {
  retailerLabel: string;
  quotedMerchandiseCostCents: number | null;
  productLabel: string;
  quantity: number;
  sizeLabel: string | null;
  colorLabel: string | null;
  batchLabel: string | null;
};

export type AdminPurchaseTrackingSlice = {
  trackingUrl?: string | null;
  retailerTrackingCompany?: string | null;
  retailerTrackingNumber?: string | null;
};

export function AdminOrderLineActions({
  orderItemId,
  fulfillmentStatus,
  linePriceCents,
  refundedCents,
  productLabel,
  orderNumber,
  batchNumber,
  batchSessionId,
  purchaseReviewContext,
  purchaseTracking,
  retailerReceiptImageUrls,
  pendingRefundRequest,
}: {
  orderItemId: string;
  fulfillmentStatus: OrderItem["fulfillmentStatus"];
  linePriceCents: number;
  refundedCents: number;
  productLabel: string;
  orderNumber?: string | null;
  batchNumber?: string | null;
  batchSessionId?: string | null;
  purchaseReviewContext?: AdminPurchaseReviewContext | null;
  /** Present on post-purchase lines so ops can edit or open shipment tracking URLs. */
  purchaseTracking?: AdminPurchaseTrackingSlice | null;
  retailerReceiptImageUrls?: string[] | null;
  pendingRefundRequest?: PendingRefundRequestBrief | null;
}) {
  const refundableCents = Math.max(0, linePriceCents - refundedCents);

  if (fulfillmentStatus === BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  if (
    fulfillmentStatus === "refunded" ||
    (refundableCents <= 0 && !pendingRefundRequest)
  ) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">
          {fulfillmentStatus === "refunded" || refundedCents >= linePriceCents
            ? "Refunded"
            : "—"}
        </span>
      </div>
    );
  }

  if (fulfillmentStatus === "paid_pending_company_purchase") {
    return (
      <div className="flex flex-col items-start gap-2">
        {pendingRefundRequest ?
          <AdminRefundRequestControls
            refundRequest={pendingRefundRequest}
            linePriceCents={linePriceCents}
            refundedCents={refundedCents}
            productLabel={productLabel}
            productNumber={orderItemId}
            orderNumber={orderNumber}
            batchNumber={batchNumber}
            batchSessionId={batchSessionId}
          />
        : null}
        <div className="flex flex-wrap gap-2">
          {purchaseReviewContext ?
            <AdminCompanyPurchaseDialog
              orderItemId={orderItemId}
              productName={purchaseReviewContext.productLabel}
              retailerLabel={purchaseReviewContext.retailerLabel}
              quantity={purchaseReviewContext.quantity}
              sizeLabel={purchaseReviewContext.sizeLabel}
              colorLabel={purchaseReviewContext.colorLabel}
              quotedMerchandiseCostCents={purchaseReviewContext.quotedMerchandiseCostCents}
              linePriceCents={linePriceCents}
              refundedCents={refundedCents}
              batchLabel={purchaseReviewContext.batchLabel}
              initialReceiptImageUrls={retailerReceiptImageUrls}
            />
          : null}
          {!pendingRefundRequest ?
            <AdminRefundOrderLineButton
              orderItemId={orderItemId}
              linePriceCents={linePriceCents}
              refundedCents={refundedCents}
              productLabel={productLabel}
            />
          : null}
        </div>
      </div>
    );
  }

  if (
    fulfillmentStatus === "company_purchase_pending_delivery" ||
    fulfillmentStatus === "delivery_requested_pending_fulfillment" ||
    fulfillmentStatus === "delivery_received_good_awaiting_barrel" ||
    fulfillmentStatus === "in_barrel_awaiting_shipping" ||
    fulfillmentStatus === "delivery_received_item_missing" ||
    fulfillmentStatus === "delivery_received_item_damaged" ||
    fulfillmentStatus === "delivery_received_wrong_item" ||
    fulfillmentStatus === "product_return_awaiting_delivery"
  ) {
    const needsReceiptCorrection =
      fulfillmentStatus === "delivery_received_item_missing" ||
      fulfillmentStatus === "delivery_received_item_damaged" ||
      fulfillmentStatus === "delivery_received_wrong_item";

    return (
      <div className="flex flex-col items-start gap-2">
        {pendingRefundRequest ?
          <AdminRefundRequestControls
            refundRequest={pendingRefundRequest}
            linePriceCents={linePriceCents}
            refundedCents={refundedCents}
            productLabel={productLabel}
            productNumber={orderItemId}
            orderNumber={orderNumber}
            batchNumber={batchNumber}
            batchSessionId={batchSessionId}
          />
        : null}
        <div className="flex flex-wrap items-center gap-2">
          <AdminPurchaseTrackingLink trackingUrl={purchaseTracking?.trackingUrl} />
          <AdminPurchaseTrackingDialog
            orderItemId={orderItemId}
            productLabel={productLabel}
            initialTrackingUrl={purchaseTracking?.trackingUrl ?? null}
            initialRetailerTrackingCompany={
              purchaseTracking?.retailerTrackingCompany ?? null
            }
            initialRetailerTrackingNumber={
              purchaseTracking?.retailerTrackingNumber ?? null
            }
            initialReceiptImageUrls={retailerReceiptImageUrls}
            variant={
              needsReceiptCorrection ||
              fulfillmentStatus === "product_return_awaiting_delivery" ?
                "return"
              : "inbound"
            }
            triggerLabel={
              fulfillmentStatus === "product_return_awaiting_delivery" ?
                "tracking"
              : undefined
            }
          />
          {!pendingRefundRequest ?
            <AdminRefundOrderLineButton
              orderItemId={orderItemId}
              linePriceCents={linePriceCents}
              refundedCents={refundedCents}
              productLabel={productLabel}
            />
          : null}
        </div>
      </div>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      {fulfillmentStatus === "pending_payment" ? "Awaiting payment" : "—"}
    </span>
  );
}
