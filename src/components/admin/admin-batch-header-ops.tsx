"use client";

import { AdminBatchCompanyPurchaseDialog } from "@/components/admin/admin-batch-company-purchase-dialog";
import type { AdminBatchPurchaseLine } from "@/components/admin/admin-batch-company-purchase-dialog";
import { AdminBatchRefundButton } from "@/components/admin/admin-batch-refund-button";
import type { AdminBatchRefundLine } from "@/components/admin/admin-batch-refund-button";
import { DashboardCheckoutChargesPreviewDialog } from "@/components/dashboard/dashboard-checkout-charges-preview-dialog";
import type { AdminPaidOrderLineRow } from "@/data/admin-order-lines";
import type { BatchQuoteEstimate } from "@/db/schema";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";
import type { BatchLineShare } from "@/lib/batch-line-share";
import { isProblemDeliveryReceiptFulfillment } from "@/lib/delivery-condition-acceptance";
import { adminMayRefundLineAfterProductReturn } from "@/lib/order-line-product-return-display";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { effectiveOutsidePurchasePaidFulfillment } from "@/lib/outside-purchase-order-fulfillment";
import { displaySiteName } from "@/lib/site-name";

function lineFulfillment(row: AdminPaidOrderLineRow) {
  return effectiveOutsidePurchasePaidFulfillment(
    row.request,
    row.orderItem,
    row.order,
  );
}

function batchPurchaseLinesFromRows(
  rows: AdminPaidOrderLineRow[],
  batchShareByRequestId: Record<string, BatchLineShare>,
): AdminBatchPurchaseLine[] {
  const out: AdminBatchPurchaseLine[] = [];
  for (const row of rows) {
    if (isOutsidePurchaseRequest(row.request)) continue;
    const fulfillment = lineFulfillment(row);
    if (fulfillment !== "paid_pending_company_purchase") continue;
    const refundable = Math.max(0, row.orderItem.price - row.refundedCents);
    if (refundable <= 0) continue;
    const r = row.request;
    out.push({
      orderItemId: row.orderItem.id,
      productName: r.productName?.trim() || "Item",
      retailerLabel: displaySiteName(r.siteName, r.productUrl),
      productUrl: r.productUrl,
      quantity: row.orderItem.quantity,
      sizeLabel: r.productSize?.trim() ?? null,
      colorLabel: r.productColor?.trim() ?? null,
      linePriceCents: row.orderItem.price,
      refundedCents: row.refundedCents,
      batchShare: batchShareByRequestId[r.id] ?? null,
      initialReceiptImageUrls: row.orderItem.companyPurchaseReceiptImageUrls,
    });
  }
  return out;
}

function batchRefundLinesFromRows(
  rows: AdminPaidOrderLineRow[],
): AdminBatchRefundLine[] {
  const out: AdminBatchRefundLine[] = [];
  for (const row of rows) {
    if (isOutsidePurchaseRequest(row.request)) continue;
    const fulfillment = lineFulfillment(row);
    if (fulfillment === BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID) continue;
    if (fulfillment === "refunded") continue;
    if (row.pendingRefundRequest) continue;
    if (isProblemDeliveryReceiptFulfillment(fulfillment)) continue;
    if (
      !adminMayRefundLineAfterProductReturn({
        fulfillmentStatus: fulfillment,
        fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
      })
    ) {
      continue;
    }
    const refundable = Math.max(0, row.orderItem.price - row.refundedCents);
    if (refundable <= 0) continue;
    out.push({
      orderItemId: row.orderItem.id,
      productLabel: row.request.productName?.trim() || "Item",
      linePriceCents: row.orderItem.price,
      refundedCents: row.refundedCents,
    });
  }
  return out;
}

/** Batch header: Review and approve + Refund line + Batch charges. */
export function AdminBatchHeaderOps({
  orderId,
  batchSessionId,
  batchNumber,
  lines,
  batchShareByRequestId = {},
  batchEstimate = null,
}: {
  orderId: string;
  batchSessionId: string;
  batchNumber: string | null;
  lines: AdminPaidOrderLineRow[];
  batchShareByRequestId?: Record<string, BatchLineShare>;
  batchEstimate?: BatchQuoteEstimate | null;
}) {
  const batchLabel =
    batchNumber?.trim() || `${batchSessionId.trim().slice(0, 8)}…`;
  const purchaseLines = batchPurchaseLinesFromRows(lines, batchShareByRequestId);
  const refundLines = batchRefundLinesFromRows(lines);

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {purchaseLines.length > 0 ?
        <AdminBatchCompanyPurchaseDialog
          batchLabel={batchLabel}
          orderId={orderId}
          batchSessionId={batchSessionId}
          batchEstimate={batchEstimate}
          lines={purchaseLines}
        />
      : null}
      {refundLines.length > 0 ?
        <AdminBatchRefundButton
          batchLabel={batchLabel}
          lines={refundLines}
          triggerLabel="Refund line"
        />
      : null}
      <DashboardCheckoutChargesPreviewDialog
        scope="batch"
        orderId={orderId}
        batchSessionId={batchSessionId}
        triggerLabel="Batch charges"
      />
    </span>
  );
}
