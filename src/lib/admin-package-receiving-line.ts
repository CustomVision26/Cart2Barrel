import type { PurchaseQueueLineRow } from "@/data/admin-purchase-queue";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import type { WarehouseReceivingLine } from "@/lib/admin-warehouse-receiving-types";

export function latestWarehouseDeliverySnapshot(
  snapshots: ItemRequestLineSnapshot[] | undefined,
): ItemRequestLineSnapshot | null {
  if (!snapshots?.length) return null;
  let latest: ItemRequestLineSnapshot | null = null;
  for (const snap of snapshots) {
    if (snap.phase === "warehouse_delivery_received") {
      latest = snap;
    }
  }
  return latest;
}

export function purchaseQueueRowToWarehouseReceivingLine(
  row: PurchaseQueueLineRow,
  snapshots?: ItemRequestLineSnapshot[],
): WarehouseReceivingLine {
  const clerkUserId = row.order.clerkUserId;
  const intakeSnap = latestWarehouseDeliverySnapshot(snapshots);

  return {
    id: row.orderItem.id,
    itemRequestId: row.orderItem.itemRequestId,
    itemLabel: `Order ${row.order.id.slice(0, 8)}… · Item ${row.orderItem.id.slice(0, 8)}…`,
    productName: row.request.productName?.trim() || "Unnamed product",
    productImageUrl: row.request.productImageUrl ?? null,
    productUrl: row.request.productUrl?.trim() || null,
    productSize: row.request.productSize?.trim() || null,
    productColor: row.request.productColor?.trim() || null,
    orderedQty: row.orderItem.quantity,
    orderItem: row.orderItem,
    orderStatus: row.order.status,
    orderNumber: row.order.id,
    batchNumber: row.resolvedBatchNumber,
    batchSessionId: row.resolvedBatchSessionId,
    clerkUserId,
    customerGroupSortKey: adminCustomerSortKey({
      fullName: row.customerFullName,
      email: row.customerEmail,
      clerkUserId,
    }),
    customerDisplayLabel: adminCustomerDisplayLabel({
      fullName: row.customerFullName,
      email: row.customerEmail,
      clerkUserId,
    }),
    refundedCents: row.refundedCents,
    pendingRefundRequest: row.pendingRefundRequest,
    companyPurchaseReceiptImageUrls: row.orderItem.companyPurchaseReceiptImageUrls ?? null,
    warehouseBarcodeImageUrl: row.orderItem.warehouseReceivedBarcodeImageUrl ?? null,
    intakeSnapshotQuantity: intakeSnap?.quantity ?? null,
    intakeSnapshotSize: intakeSnap?.productSize?.trim() || null,
    intakeSnapshotColor: intakeSnap?.productColor?.trim() || null,
    intakeSnapshotProductUrl: intakeSnap?.productUrl?.trim() || null,
    intakeSnapshotProductImageUrl: intakeSnap?.productImageUrl?.trim() || null,
  };
}
