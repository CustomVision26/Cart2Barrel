import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequestLineSnapshots, orderItems, orders } from "@/db/schema";
import {
  orderItemFulfillmentCoreSelectWithWarehouse,
  orderListSelect,
} from "@/data/order-list-select";
import { getItemRequestById } from "@/data/item-requests";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import {
  isInvalidOrderItemFulfillmentStatusEnumError,
  isMissingOrderItemWarehouseReceiptColumnsError,
} from "@/lib/db-column-missing";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import type { SaveWarehouseReceiptSnapshotsInput } from "@/lib/validations/admin-warehouse-receipt";
import {
  buildWarehouseReceiptAuditMemo,
  warehouseReceiptHumanNote,
} from "@/lib/warehouse-receipt-snapshot-memo";
import { fulfillmentStatusFromWarehouseReceiveCondition } from "@/lib/warehouse-receive-fulfillment";
import { canSubmitWarehouseReceiptForFulfillment } from "@/lib/warehouse-receipt-queue";

export type ApplyWarehouseReceiptAuthz =
  | { kind: "admin" }
  | { kind: "customer"; clerkUserId: string };

export type ApplyWarehouseReceiptResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Inserts warehouse_delivery_received snapshots and updates `order_items` receipt columns +
 * `fulfillment_status` from receive condition. No `db.transaction` (neon-http).
 */
export async function applyWarehouseReceiptLines(
  parsed: SaveWarehouseReceiptSnapshotsInput,
  authz: ApplyWarehouseReceiptAuthz,
): Promise<ApplyWarehouseReceiptResult> {
  const db = getDb();
  const snapshotRows: (typeof itemRequestLineSnapshots.$inferInsert)[] = [];

  try {
    for (const line of parsed.lines) {
      const [row] = await db
        .select({
          orderItem: orderItemFulfillmentCoreSelectWithWarehouse,
          order: orderListSelect,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orderItems.id, line.orderItemId))
        .limit(1);

      if (!row || row.order.status !== "paid") {
        return { ok: false, message: "One or more order lines were not found." };
      }

      if (authz.kind === "customer" && row.order.clerkUserId !== authz.clerkUserId) {
        return {
          ok: false,
          message: "One or more order lines do not belong to your account.",
        };
      }

      let refunded = 0;
      try {
        const refundedMap = await sumRefundedCentsByOrderItemIds([
          row.orderItem.id,
        ]);
        refunded = refundedMap.get(row.orderItem.id) ?? 0;
      } catch {
        refunded = 0;
      }
      if (
        row.orderItem.fulfillmentStatus === "refunded" ||
        refunded >= row.orderItem.price
      ) {
        return {
          ok: false,
          message: "A selected line was refunded and cannot be received.",
        };
      }

      const effectiveFulfillment = effectiveOrderItemFulfillmentStatus(
        row.orderItem,
        row.order,
      );
      if (!canSubmitWarehouseReceiptForFulfillment(effectiveFulfillment)) {
        return {
          ok: false,
          message:
            "Receipt can only be submitted for lines awaiting inbound delivery, needing receipt correction, or good receipt awaiting barrel (Packages).",
        };
      }

      const orderedQty = row.orderItem.quantity;
      const req = await getItemRequestById(row.orderItem.itemRequestId);
      if (!req) {
        return {
          ok: false,
          message: "Request line not found for an order item.",
        };
      }

      const payload = lineSnapshotPayloadFromItemRequest(req);
      payload.quantity = line.receivedQty;

      const memoPayload = {
        kind: "warehouse_receipt_v1" as const,
        orderItemId: row.orderItem.id,
        orderedQty,
        receivedQty: line.receivedQty,
        condition: line.condition,
        shelfLocation: line.shelfLocation.trim(),
        proofPhotoCount: line.proofPhotoCount,
        barcodeValue:
          line.barcodeValue?.trim() === "" ? undefined : line.barcodeValue?.trim(),
      };

      const auditMemo = buildWarehouseReceiptAuditMemo(memoPayload);
      const note = warehouseReceiptHumanNote({
        orderItemShortId: row.orderItem.id.slice(0, 8),
        orderedQty,
        receivedQty: line.receivedQty,
        conditionKey: line.condition,
        shelfLocation: line.shelfLocation,
        proofPhotoCount: line.proofPhotoCount,
        barcodeValue: memoPayload.barcodeValue,
      });

      snapshotRows.push({
        itemRequestId: row.orderItem.itemRequestId,
        phase: "warehouse_delivery_received",
        itemQuoteId: null,
        batchQuoteSessionId: null,
        auditMemo,
        productUrl: payload.productUrl,
        productName: payload.productName,
        productSize: payload.productSize,
        productColor: payload.productColor,
        quantity: payload.quantity,
        note,
        productImageUrl: payload.productImageUrl,
        siteName: payload.siteName,
      });
    }

    const receivedAt = new Date().toISOString();

    // Update line first so a DB failure (e.g. missing fulfillment enum values) does not leave
    // an audit snapshot without a matching `order_items` row update.
    for (let i = 0; i < snapshotRows.length; i++) {
      const line = parsed.lines[i]!;
      const shelfTrim = line.shelfLocation.trim();
      const barcodeTrim = line.barcodeValue?.trim();
      await db
        .update(orderItems)
        .set({
          fulfillmentStatus: fulfillmentStatusFromWarehouseReceiveCondition(
            line.condition,
          ),
          warehouseReceivedAt: receivedAt,
          warehouseReceivedQty: line.receivedQty,
          warehouseReceivedCondition: line.condition,
          warehouseShelfLocation: shelfTrim === "" ? null : shelfTrim,
          warehouseReceivedBarcode:
            barcodeTrim === undefined || barcodeTrim === "" ? null : barcodeTrim,
          warehouseReceivedProofPhotoCount: line.proofPhotoCount,
        })
        .where(eq(orderItems.id, line.orderItemId));
      await db.insert(itemRequestLineSnapshots).values(snapshotRows[i]!);
    }

    const n = parsed.lines.length;
    return {
      ok: true,
      message:
        n === 1 ?
          "Submitted receipt on the order line and added an audit trail snapshot."
        : `Submitted ${n} receipts on order lines and added audit trail snapshots.`,
    };
  } catch (e) {
    if (isMissingOrderItemWarehouseReceiptColumnsError(e)) {
      return {
        ok: false,
        message:
          "Database is missing warehouse receipt columns on order_items. Apply migration 0023_order_items_warehouse_receipt (or run npm run db:push), then try again.",
      };
    }
    if (isInvalidOrderItemFulfillmentStatusEnumError(e)) {
      return {
        ok: false,
        message:
          'Database is missing fulfillment statuses for "delivery received" (e.g. delivery_received_good_awaiting_barrel). Apply migration 0024_order_item_delivery_received_fulfillment or run npm run db:push, then try again.',
      };
    }
    throw e;
  }
}
