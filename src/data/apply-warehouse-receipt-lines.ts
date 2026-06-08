import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequestLineSnapshots, orderItems, orders } from "@/db/schema";
import { ensureInboundPackageForOrderItem } from "@/data/ensure-inbound-package-for-order-item";
import {
  orderItemFulfillmentCoreSelectWithWarehouse,
  orderListSelect,
} from "@/data/order-list-select";
import { getItemRequestById } from "@/data/item-requests";
import { fulfilledProductReturnRequestsByOrderItemIds } from "@/data/order-item-product-return-requests";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { recordWarehouseDeliveryReceivedActivity } from "@/data/user-status-update-events";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import {
  isInvalidOrderItemFulfillmentStatusEnumError,
  isMissingOrderItemWarehouseReceiptColumnsError,
} from "@/lib/db-column-missing";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import type { SaveWarehouseReceiptSnapshotsInput } from "@/lib/validations/admin-warehouse-receipt";
import {
  buildWarehouseReceiptAuditMemoV2,
  parseWarehouseReceiptMemo,
  warehouseReceiptHumanNote,
  warehouseReceiptV2FromOrderItemRow,
} from "@/lib/warehouse-receipt-snapshot-memo";
import type { WarehouseReceiptMemoV2 } from "@/lib/validations/admin-warehouse-receipt";
import { fulfillmentStatusFromWarehouseReceiveCondition } from "@/lib/warehouse-receive-fulfillment";
import { isMoneyBackProductReturn } from "@/lib/order-line-product-return-display";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { canSubmitWarehouseReceiptForFulfillment } from "@/lib/warehouse-receipt-queue";

export type ApplyWarehouseReceiptAuthz =
  | { kind: "admin"; clerkUserId: string }
  | { kind: "customer"; clerkUserId: string };

export type ApplyWarehouseReceiptResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function maxWarehouseIntakeSequence(
  snapshotMemos: (string | null)[],
): number {
  let max = 0;
  for (const memo of snapshotMemos) {
    const parsed = parseWarehouseReceiptMemo(memo);
    if (parsed?.intakeSequence != null) {
      max = Math.max(max, parsed.intakeSequence);
    }
  }
  return max;
}

function priorIntakeAlreadyArchived(
  snapshotMemos: (string | null)[],
  orderItemId: string,
  recordedAt: string,
): boolean {
  return snapshotMemos.some((memo) => {
    const parsed = parseWarehouseReceiptMemo(memo);
    return (
      parsed?.intakeRole === "prior" &&
      parsed.orderItemId === orderItemId &&
      parsed.recordedAt === recordedAt
    );
  });
}

/**
 * Inserts warehouse_delivery_received snapshots and updates `order_items` receipt columns +
 * `fulfillment_status` from receive condition. No `db.transaction` (neon-http).
 */
export async function applyWarehouseReceiptLines(
  parsed: SaveWarehouseReceiptSnapshotsInput,
  authz: ApplyWarehouseReceiptAuthz,
): Promise<ApplyWarehouseReceiptResult> {
  const db = getDb();

  try {
    const fulfilledReturnByOrderItemId =
      await fulfilledProductReturnRequestsByOrderItemIds(
        parsed.lines.map((l) => l.orderItemId),
      );

    const customerNotifications: {
      clerkUserId: string;
      orderId: string;
      orderItemId: string;
      productName: string | null;
      statusLabel: string;
    }[] = [];

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

      if (
        effectiveFulfillment === "product_return_awaiting_delivery" &&
        isMoneyBackProductReturn(
          fulfilledReturnByOrderItemId.get(row.orderItem.id)?.desiredOutcome,
        )
      ) {
        return {
          ok: false,
          message:
            "This line is a money-back return awaiting refund. Use Refund line — do not log another inbound receipt.",
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

      const existingSnapshots = await db
        .select({
          auditMemo: itemRequestLineSnapshots.auditMemo,
          phase: itemRequestLineSnapshots.phase,
        })
        .from(itemRequestLineSnapshots)
        .where(eq(itemRequestLineSnapshots.itemRequestId, row.orderItem.itemRequestId))
        .orderBy(asc(itemRequestLineSnapshots.createdAt));
      const existingMemos = existingSnapshots.map((s) => s.auditMemo);
      const legacyIntakeCount = existingSnapshots.filter(
        (s) =>
          s.phase === "warehouse_delivery_received" ||
          s.phase === "warehouse_delivery_received_prior",
      ).length;

      let maxSeq = Math.max(
        maxWarehouseIntakeSequence(existingMemos),
        legacyIntakeCount,
      );

      const receivedAt = new Date().toISOString();
      const shelfTrim = line.shelfLocation.trim();
      const conditionNotesTrim = line.conditionNotes?.trim() ?? "";
      const barcodeTrim = line.barcodeValue?.trim();
      const missingReason =
        line.condition === "missing" ? line.missingReason : undefined;
      const proofUrls = line.proofPhotoUrls;
      const proofCount =
        proofUrls !== undefined ? proofUrls.length : line.proofPhotoCount;

      const inserts: (typeof itemRequestLineSnapshots.$inferInsert)[] = [];

      const isReplacementInbound =
        effectiveFulfillment === "product_return_awaiting_delivery";
      const priorRecordedAt = row.orderItem.warehouseReceivedAt?.trim();

      if (
        isReplacementInbound &&
        priorRecordedAt &&
        !priorIntakeAlreadyArchived(
          existingMemos,
          row.orderItem.id,
          priorRecordedAt,
        )
      ) {
        const priorSeq = maxSeq > 0 ? maxSeq : 1;
        const priorPack = warehouseReceiptV2FromOrderItemRow(row.orderItem, {
          intakeSequence: priorSeq,
          intakeRole: "prior",
          intakeContext: "replacement_after_return",
          recordedAt: priorRecordedAt,
        });
        inserts.push({
          itemRequestId: row.orderItem.itemRequestId,
          phase: "warehouse_delivery_received_prior",
          itemQuoteId: null,
          batchQuoteSessionId: null,
          auditMemo: priorPack.memo,
          productUrl: payload.productUrl,
          productName: payload.productName,
          productSize: payload.productSize,
          productColor: payload.productColor,
          quantity: payload.quantity,
          note: priorPack.note,
          productImageUrl: payload.productImageUrl,
          siteName: payload.siteName,
        });
        maxSeq = Math.max(maxSeq, priorSeq);
      }

      const activeSeq = maxSeq + 1;
      const activeContext: WarehouseReceiptMemoV2["intakeContext"] =
        isReplacementInbound ? "replacement_after_return" : "initial_inbound";
      const activeMemoPayload: WarehouseReceiptMemoV2 = {
        kind: "warehouse_receipt_v2",
        orderItemId: row.orderItem.id,
        intakeSequence: activeSeq,
        intakeRole: "active",
        intakeContext: activeContext,
        recordedAt: receivedAt,
        orderedQty,
        receivedQty: line.receivedQty,
        condition: line.condition,
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
        receivedQty: line.receivedQty,
        conditionKey: line.condition,
        missingReason,
        conditionNotes:
          conditionNotesTrim === "" ? undefined : conditionNotesTrim,
        shelfLocation: line.shelfLocation,
        proofPhotoCount: proofCount,
        barcodeValue: activeMemoPayload.barcodeValue,
        intakeRole: "active",
        intakeSequence: activeSeq,
        intakeContext: activeContext,
      });

      inserts.push({
        itemRequestId: row.orderItem.itemRequestId,
        phase: "warehouse_delivery_received",
        itemQuoteId: null,
        batchQuoteSessionId: null,
        auditMemo: buildWarehouseReceiptAuditMemoV2(activeMemoPayload),
        recordedByClerkUserId:
          authz.kind === "admin" ? authz.clerkUserId : null,
        productUrl: payload.productUrl,
        productName: payload.productName,
        productSize: payload.productSize,
        productColor: payload.productColor,
        quantity: payload.quantity,
        note: activeNote,
        productImageUrl: payload.productImageUrl,
        siteName: payload.siteName,
      });

      await db
        .update(orderItems)
        .set({
          fulfillmentStatus: fulfillmentStatusFromWarehouseReceiveCondition(
            line.condition,
          ),
          warehouseReceivedAt: receivedAt,
          warehouseReceivedQty: line.receivedQty,
          warehouseReceivedCondition: line.condition,
          warehouseReceivedMissingReason: missingReason ?? null,
          warehouseReceivedConditionNotes:
            conditionNotesTrim === "" ? null : conditionNotesTrim,
          warehouseShelfLocation: shelfTrim === "" ? null : shelfTrim,
          warehouseReceivedBarcode:
            barcodeTrim === undefined || barcodeTrim === "" ? null : barcodeTrim,
          warehouseReceivedProofPhotoCount: proofCount,
          ...(authz.kind === "admin" ?
            { warehouseReceivedByClerkUserId: authz.clerkUserId }
          : {}),
          ...(proofUrls !== undefined ?
            {
              warehouseReceivedProofPhotoUrls:
                proofUrls.length > 0 ? proofUrls : null,
            }
          : {}),
        })
        .where(eq(orderItems.id, line.orderItemId));

      if (
        fulfillmentStatusFromWarehouseReceiveCondition(line.condition) ===
        "delivery_received_good_awaiting_barrel"
      ) {
        await ensureInboundPackageForOrderItem(line.orderItemId, receivedAt);
      }

      for (const snap of inserts) {
        await db.insert(itemRequestLineSnapshots).values(snap);
      }

      if (authz.kind === "admin") {
        const nextFulfillment = fulfillmentStatusFromWarehouseReceiveCondition(
          line.condition,
        );
        customerNotifications.push({
          clerkUserId: row.order.clerkUserId,
          orderId: row.order.id,
          orderItemId: row.orderItem.id,
          productName: req.productName,
          statusLabel: adminOrderLineStatusLabel(nextFulfillment, {
            warehouseReceivedCondition: line.condition,
          }),
        });
      }
    }

    for (const notification of customerNotifications) {
      await recordWarehouseDeliveryReceivedActivity(notification);
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
