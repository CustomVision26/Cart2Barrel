import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequestLineSnapshots, orderItems, orders } from "@/db/schema";
import { ensureInboundPackageForOrderItem } from "@/data/ensure-inbound-package-for-order-item";
import { ensureInBarrelAwaitingShippingEnumValue } from "@/data/ensure-in-barrel-fulfillment-enum";
import {
  getLatestQuoteForItemRequest,
  insertCheckoutTimelineQuote,
} from "@/data/item-quotes";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { getItemRequestById } from "@/data/item-requests";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import {
  orderItemFulfillmentCoreSelectWithWarehouse,
  orderListSelect,
} from "@/data/order-list-select";
import { recordWarehouseDeliveryReceivedActivity } from "@/data/user-status-update-events";
import { ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE } from "@/lib/checkout-snapshot-kind";
import { COMPANY_PURCHASE_INBOUND_STORE_PICKUP } from "@/lib/company-purchase-inbound";
import {
  isInvalidOrderItemFulfillmentStatusEnumError,
  isMissingOrderItemWarehouseReceiptColumnsError,
} from "@/lib/db-column-missing";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import type { ConfirmCompanyPurchaseStorePickupInput } from "@/lib/validations/admin-order-item";
import type { WarehouseReceiptMemoV2 } from "@/lib/validations/admin-warehouse-receipt";
import {
  buildWarehouseReceiptAuditMemoV2,
  warehouseReceiptHumanNote,
} from "@/lib/warehouse-receipt-snapshot-memo";
import { fulfillmentStatusAfterStorePickupIntake } from "@/lib/warehouse-receive-fulfillment";
import { BARREL_PIPELINE_IN_CONTAINER } from "@/lib/barrel-pipeline-fulfillment";

export type ApplyCompanyPurchaseStorePickupResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function applyCompanyPurchaseStorePickup(
  parsed: ConfirmCompanyPurchaseStorePickupInput,
  adminClerkUserId: string,
): Promise<ApplyCompanyPurchaseStorePickupResult> {
  const db = getDb();

  try {
    const [row] = await db
      .select({
        orderItem: orderItemFulfillmentCoreSelectWithWarehouse,
        order: orderListSelect,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orderItems.id, parsed.orderItemId))
      .limit(1);

    if (!row || row.order.status !== "paid") {
      return { ok: false, message: "Order line not found." };
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
        message: "This line was refunded and cannot be marked as purchased.",
      };
    }

    const effectiveFulfillment = effectiveOrderItemFulfillmentStatus(
      row.orderItem,
      row.order,
    );
    if (effectiveFulfillment !== "paid_pending_company_purchase") {
      return {
        ok: false,
        message: "This product is not awaiting company purchase.",
      };
    }

    const nextFulfillment = fulfillmentStatusAfterStorePickupIntake(parsed.condition);
    if (nextFulfillment === BARREL_PIPELINE_IN_CONTAINER) {
      const ready = await ensureInBarrelAwaitingShippingEnumValue();
      if (!ready) {
        return {
          ok: false,
          message:
            'Database is missing fulfillment status in_barrel_awaiting_shipping. Run npm run db:push.',
        };
      }
    }

    const receivedAt = parsed.storePickupAt;
    const orderedQty = row.orderItem.quantity;
    const shelfTrim = parsed.shelfLocation.trim();
    const conditionNotesTrim = parsed.conditionNotes?.trim() ?? "";
    const barcodeTrim = parsed.barcodeValue?.trim();
    const missingReason =
      parsed.condition === "missing" ? parsed.missingReason : undefined;
    const proofUrls = parsed.proofPhotoUrls;
    const proofCount =
      proofUrls !== undefined ? proofUrls.length : parsed.proofPhotoCount;

    await db
      .update(orderItems)
      .set({
        fulfillmentStatus: nextFulfillment,
        companyPurchaseInboundMethod: COMPANY_PURCHASE_INBOUND_STORE_PICKUP,
        storePickupAt: receivedAt,
        companyPurchaseUpdatedByClerkUserId: adminClerkUserId,
        warehouseReceivedAt: receivedAt,
        warehouseReceivedQty: parsed.receivedQty,
        warehouseReceivedCondition: parsed.condition,
        warehouseReceivedMissingReason: missingReason ?? null,
        warehouseReceivedConditionNotes:
          conditionNotesTrim === "" ? null : conditionNotesTrim,
        warehouseShelfLocation: shelfTrim === "" ? null : shelfTrim,
        warehouseReceivedBarcode:
          barcodeTrim === undefined || barcodeTrim === "" ? null : barcodeTrim,
        warehouseReceivedProofPhotoCount: proofCount,
        warehouseReceivedProofPhotoUrls:
          proofUrls && proofUrls.length > 0 ? proofUrls : null,
        warehouseReceivedByClerkUserId: adminClerkUserId,
      })
      .where(eq(orderItems.id, row.orderItem.id));

    if (nextFulfillment === BARREL_PIPELINE_IN_CONTAINER) {
      await ensureInboundPackageForOrderItem(row.orderItem.id, receivedAt);
    }

    const quote = await getLatestQuoteForItemRequest(row.orderItem.itemRequestId);
    if (quote) {
      const timelineQuote = await insertCheckoutTimelineQuote({
        itemRequestId: row.orderItem.itemRequestId,
        sourceQuote: quote,
        checkoutSnapshotKind: ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE,
      });
      const req = await getItemRequestById(row.orderItem.itemRequestId);
      if (req) {
        const purchaseLine = lineSnapshotPayloadFromItemRequest(req);
        purchaseLine.note = `Store pickup recorded at ${receivedAt}.`;
        await insertItemRequestLineSnapshot({
          itemRequestId: row.orderItem.itemRequestId,
          phase: "company_purchase_pending_delivery",
          itemQuoteId: timelineQuote.id,
          recordedByClerkUserId: adminClerkUserId,
          line: purchaseLine,
        });
      }
    }

    const req = await getItemRequestById(row.orderItem.itemRequestId);
    if (!req) {
      return { ok: false, message: "Request line not found for an order item." };
    }

    const payload = lineSnapshotPayloadFromItemRequest(req);
    payload.quantity = parsed.receivedQty;

    const activeMemoPayload: WarehouseReceiptMemoV2 = {
      kind: "warehouse_receipt_v2",
      orderItemId: row.orderItem.id,
      intakeSequence: 1,
      intakeRole: "active",
      intakeContext: "initial_inbound",
      recordedAt: receivedAt,
      orderedQty,
      receivedQty: parsed.receivedQty,
      condition: parsed.condition,
      missingReason,
      conditionNotes:
        conditionNotesTrim === "" ? undefined : conditionNotesTrim,
      shelfLocation: shelfTrim,
      proofPhotoCount: proofCount,
      proofPhotoUrls:
        proofUrls && proofUrls.length > 0 ? proofUrls : undefined,
      barcodeValue:
        barcodeTrim === undefined || barcodeTrim === "" ? undefined : barcodeTrim,
    };

    const activeNote = warehouseReceiptHumanNote({
      orderItemShortId: row.orderItem.id.slice(0, 8),
      orderedQty,
      receivedQty: parsed.receivedQty,
      conditionKey: parsed.condition,
      missingReason,
      conditionNotes:
        conditionNotesTrim === "" ? undefined : conditionNotesTrim,
      shelfLocation: parsed.shelfLocation,
      proofPhotoCount: proofCount,
      barcodeValue: activeMemoPayload.barcodeValue,
      intakeRole: "active",
      intakeSequence: 1,
      intakeContext: "initial_inbound",
    });

    await db.insert(itemRequestLineSnapshots).values({
      itemRequestId: row.orderItem.itemRequestId,
      phase: "warehouse_delivery_received",
      itemQuoteId: null,
      batchQuoteSessionId: null,
      auditMemo: buildWarehouseReceiptAuditMemoV2(activeMemoPayload),
      recordedByClerkUserId: adminClerkUserId,
      productUrl: payload.productUrl,
      productName: payload.productName,
      productSize: payload.productSize,
      productColor: payload.productColor,
      quantity: payload.quantity,
      note: `${activeNote} · Store pickup.`,
      productImageUrl: payload.productImageUrl,
      siteName: payload.siteName,
    });

    await recordWarehouseDeliveryReceivedActivity({
      clerkUserId: row.order.clerkUserId,
      orderId: row.order.id,
      orderItemId: row.orderItem.id,
      productName: req.productName,
      statusLabel: adminOrderLineStatusLabel(nextFulfillment, {
        warehouseReceivedCondition: parsed.condition,
        companyPurchaseInboundMethod: COMPANY_PURCHASE_INBOUND_STORE_PICKUP,
      }),
    });

    return {
      ok: true,
      message:
        parsed.condition === "good" ?
          "Recorded store pickup and moved this line to the barrel packing queue."
        : "Recorded store pickup with a problem receipt — line stays on purchase orders until resolved.",
    };
  } catch (e) {
    if (isMissingOrderItemWarehouseReceiptColumnsError(e)) {
      return {
        ok: false,
        message:
          "Database is missing warehouse receipt or store pickup columns. Run npm run db:push, then try again.",
      };
    }
    if (isInvalidOrderItemFulfillmentStatusEnumError(e)) {
      return {
        ok: false,
        message:
          'Database is missing fulfillment statuses for store pickup. Run npm run db:push, then try again.',
      };
    }
    throw e;
  }
}
