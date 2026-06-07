import type { ItemRequestLineSnapshot } from "@/db/schema";
import {
  AUDIT_BASELINE_SNAPSHOT_SUMMARY,
  AUDIT_NO_LINE_FIELD_DIFF_SUMMARY,
} from "@/lib/audit-snapshot-duplicate-copy";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import {
  parseProductReturnTrackingMemo,
  PRODUCT_RETURN_STATUS_HEADLINE,
} from "@/lib/product-return-tracking-memo";
import {
  parseRefundRequestAuditMemo,
  refundRequestReasonKindLabel,
} from "@/lib/refund-request-audit-memo";
import { parseWarehouseReceiptMemo } from "@/lib/warehouse-receipt-snapshot-memo";
import {
  outsidePurchaseIntakeDraftStatusLabel,
  outsidePurchasePublishedStatusLabel,
  type AuditSnapshotStatusContext,
} from "@/lib/outside-purchase-intake-audit-memo";
import {
  OUTSIDE_PURCHASE_RETURN_ESTIMATE_ACCEPTED_STATUS_LABEL,
  OUTSIDE_PURCHASE_RETURN_REQUESTED_STATUS_LABEL,
} from "@/lib/outside-purchase-display";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL } from "@/lib/outside-purchase-paid-status";
import { PRODUCT_RETURN_REQUEST_PENDING_LABEL } from "@/lib/product-return-request-labels";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";

function trimEq(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a?.trim() || "") === (b?.trim() || "");
}

/** One-line shopper/ops-facing headline for this snapshot row. */
export function auditSnapshotStatusHeadline(
  row: ItemRequestLineSnapshot,
  context?: AuditSnapshotStatusContext,
): string {
  switch (row.phase) {
    case "warehouse_delivery_received":
    case "warehouse_delivery_received_prior": {
      const wr = parseWarehouseReceiptMemo(row.auditMemo);
      if (wr) {
        const prefix =
          wr.intakeRole === "prior" ?
            `Prior intake #${wr.intakeSequence ?? "?"}`
          : wr.intakeContext === "replacement_after_return" ?
            `Replacement receipt #${wr.intakeSequence ?? "?"}`
          : "Inbound receipt";
        return `${prefix} · ${warehouseReceiveConditionLabel(wr.condition)} · ${wr.receivedQty}/${wr.orderedQty} pcs`;
      }
      return itemRequestLineSnapshotPhaseLabel(row.phase);
    }
    case "product_return_requested":
      return PRODUCT_RETURN_REQUEST_PENDING_LABEL;
    case "product_return_tracking_saved": {
      const memo = parseProductReturnTrackingMemo(row.auditMemo);
      const noteFirst = row.note?.trim().split("\n")[0]?.trim();
      if (noteFirst) return noteFirst;
      if (memo?.trackingUrl?.trim()) return `${PRODUCT_RETURN_STATUS_HEADLINE} · URL on file`;
      return PRODUCT_RETURN_STATUS_HEADLINE;
    }
    case "customer_refund_request_submitted": {
      const memo = parseRefundRequestAuditMemo(row.auditMemo);
      if (memo) {
        return `Refund request · ${refundRequestReasonKindLabel(memo.reasonKind)}`;
      }
      const first = row.note?.trim().split("\n")[0]?.trim();
      return first || itemRequestLineSnapshotPhaseLabel(row.phase);
    }
    case "checkout_paid_pending_delivery":
      return "Checkout complete · awaiting company purchase";
    case "company_purchase_pending_delivery":
      return "Company purchase recorded · inbound coordination";
    case "removed_from_cart":
      return "Removed from cart";
    case "customer_submission":
      return "Customer submitted this line";
    case "customer_line_edit":
      return "Customer updated line details";
    case "post_admin_estimate_edit":
      return "Staff saved quote / estimate";
    case "batch_estimate_customer_copy":
      return "Batch estimate · customer-facing copy";
    case "batch_estimate_admin_copy":
      return "quoted for batch";
    case "batch_request_submitted_to_staff":
      return "new request in batch";
    case "outside_purchase_intake":
      return outsidePurchaseIntakeDraftStatusLabel(row.auditMemo);
    case "outside_purchase_published":
      return outsidePurchasePublishedStatusLabel({
        row,
        snapshots: context?.snapshots,
        quoteStaffNote: context?.quoteStaffNote,
        receivedConditionRaw: context?.receivedConditionRaw,
      });
    case "outside_purchase_unpublished":
      return "Withdrawn from customer · admin pool only";
    case "outside_purchase_payment_prompted":
      return "Staff recorded payment prompt · add to cart";
    case "outside_purchase_added_to_cart":
      return "Customer added to cart · service & handling due at checkout";
    case "outside_purchase_removed_from_cart":
      return row.auditMemo?.trim() || "Customer updated cart membership";
    case "outside_purchase_withdrawn_from_active":
      return "Removed from Active · moved to Product history";
    case "outside_purchase_reinstated_to_active":
      return row.auditMemo?.trim() || "Back on Active · payment still due if unpaid";
    case "outside_purchase_return_requested":
      return OUTSIDE_PURCHASE_RETURN_REQUESTED_STATUS_LABEL;
    case "outside_purchase_return_estimate_ready":
      return "Return estimate ready";
    case "outside_purchase_return_estimate_accepted":
      return OUTSIDE_PURCHASE_RETURN_ESTIMATE_ACCEPTED_STATUS_LABEL;
    case "outside_purchase_return_cancelled":
      return row.auditMemo?.trim() || "Return request cancelled";
    case "outside_purchase_checkout_paid":
      return PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL;
    default:
      return itemRequestLineSnapshotPhaseLabel(row.phase);
  }
}

export {
  AUDIT_NO_LINE_FIELD_DIFF_SUMMARY,
  isDuplicateFrozenCopySnapshotSummary,
} from "@/lib/audit-snapshot-duplicate-copy";

export type { AuditSnapshotStatusContext } from "@/lib/outside-purchase-intake-audit-memo";

/**
 * Describes how this row differs from the prior snapshot (same request line, chronological).
 */
export function auditSnapshotChangeSummary(
  row: ItemRequestLineSnapshot,
  prev: ItemRequestLineSnapshot | null,
): string {
  if (!prev) {
    return AUDIT_BASELINE_SNAPSHOT_SUMMARY;
  }

  const parts: string[] = [];

  if (row.phase !== prev.phase) {
    parts.push(
      `${itemRequestLineSnapshotPhaseLabel(prev.phase)} → ${itemRequestLineSnapshotPhaseLabel(row.phase)}`,
    );
  }

  if (!trimEq(row.productName, prev.productName)) {
    parts.push("Product title changed");
  }
  if (!trimEq(row.productSize, prev.productSize)) {
    parts.push(
      `Size: ${prev.productSize?.trim() || "—"} → ${row.productSize?.trim() || "—"}`,
    );
  }
  if (!trimEq(row.productColor, prev.productColor)) {
    parts.push(
      `Color: ${prev.productColor?.trim() || "—"} → ${row.productColor?.trim() || "—"}`,
    );
  }
  if (row.quantity !== prev.quantity) {
    parts.push(`Qty: ${prev.quantity} → ${row.quantity}`);
  }
  if (!trimEq(row.productUrl, prev.productUrl)) {
    parts.push("Product URL changed");
  }
  if (!trimEq(row.siteName, prev.siteName)) {
    parts.push("Retailer / site label changed");
  }

  const wr = parseWarehouseReceiptMemo(row.auditMemo);
  const wrPrev = parseWarehouseReceiptMemo(prev.auditMemo);
  if (wr && wrPrev) {
    if (wr.condition !== wrPrev.condition) {
      parts.push(
        `Receipt condition: ${warehouseReceiveConditionLabel(wrPrev.condition)} → ${warehouseReceiveConditionLabel(wr.condition)}`,
      );
    }
    if (wr.receivedQty !== wrPrev.receivedQty || wr.orderedQty !== wrPrev.orderedQty) {
      parts.push(
        `Received qty: ${wrPrev.receivedQty}/${wrPrev.orderedQty} → ${wr.receivedQty}/${wr.orderedQty}`,
      );
    }
  } else if (wr && !wrPrev && row.phase === "warehouse_delivery_received") {
    parts.push(
      `Inbound receipt logged (${warehouseReceiveConditionLabel(wr.condition)})`,
    );
  }

  const pr = parseProductReturnTrackingMemo(row.auditMemo);
  const prPrev = parseProductReturnTrackingMemo(prev.auditMemo);
  if (row.phase === "product_return_tracking_saved" && pr) {
    if (!prPrev) {
      parts.push("Return shipment tracking recorded");
    } else if (
      pr.trackingUrl !== prPrev.trackingUrl ||
      pr.retailerTrackingNumber !== prPrev.retailerTrackingNumber ||
      pr.retailerTrackingCompany !== prPrev.retailerTrackingCompany
    ) {
      parts.push("Return tracking details updated");
    }
  }

  const refundMemo =
    row.phase === "customer_refund_request_submitted"
      ? parseRefundRequestAuditMemo(row.auditMemo)
      : null;
  if (refundMemo && prev?.phase !== "customer_refund_request_submitted") {
    parts.push("Customer submitted refund request for staff approval");
  }

  if (parts.length === 0) {
    return AUDIT_NO_LINE_FIELD_DIFF_SUMMARY;
  }
  return parts.join(" · ");
}
