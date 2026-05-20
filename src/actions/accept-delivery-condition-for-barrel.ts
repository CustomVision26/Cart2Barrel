"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { itemRequestLineSnapshots, orderItems, orders } from "@/db/schema";
import { ensureInboundPackageForOrderItem } from "@/data/ensure-inbound-package-for-order-item";
import { getItemRequestById } from "@/data/item-requests";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { orderItemFulfillmentCoreSelectWithWarehouse } from "@/data/order-list-select";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { BARREL_PIPELINE_AWAITING_ASSIGNMENT } from "@/lib/barrel-pipeline-fulfillment";
import {
  isProblemDeliveryReceiptFulfillment,
  problemDeliveryWarehouseCondition,
} from "@/lib/delivery-condition-acceptance";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import { acceptDeliveryConditionForBarrelSchema } from "@/lib/validations/accept-delivery-condition-for-barrel";

export type AcceptDeliveryConditionForBarrelState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function acceptDeliveryConditionForBarrelAction(
  raw: unknown,
): Promise<AcceptDeliveryConditionForBarrelState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const parsed = acceptDeliveryConditionForBarrelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const db = getDb();
  const { orderItemId } = parsed.data;

  const [row] = await db
    .select({
      orderItem: orderItemFulfillmentCoreSelectWithWarehouse,
      order: { id: orders.id, status: orders.status, clerkUserId: orders.clerkUserId },
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(eq(orderItems.id, orderItemId), eq(orders.clerkUserId, userId))!,
    )
    .limit(1);

  if (!row || row.order.status !== "paid") {
    return { ok: false, message: "Order line not found." };
  }

  const fulfillment = row.orderItem.fulfillmentStatus;
  if (!isProblemDeliveryReceiptFulfillment(fulfillment)) {
    return {
      ok: false,
      message: "This line is not awaiting your acceptance of the delivery condition.",
    };
  }

  const condition = problemDeliveryWarehouseCondition(
    fulfillment,
    row.orderItem.warehouseReceivedCondition,
  );
  if (!condition || (condition !== "damaged" && condition !== "wrong_item")) {
    return {
      ok: false,
      message: "Only damaged or wrong-item receipts can be accepted for barrel packing.",
    };
  }

  let refunded = 0;
  try {
    const refundedMap = await sumRefundedCentsByOrderItemIds([orderItemId]);
    refunded = refundedMap.get(orderItemId) ?? 0;
  } catch {
    refunded = 0;
  }
  if (refunded >= row.orderItem.price) {
    return { ok: false, message: "This line was refunded." };
  }

  const receivedAt = row.orderItem.warehouseReceivedAt ?? new Date().toISOString();
  const conditionLabel = warehouseReceiveConditionLabel(condition);

  await db
    .update(orderItems)
    .set({
      fulfillmentStatus: BARREL_PIPELINE_AWAITING_ASSIGNMENT,
      warehouseReceivedCondition: condition,
    })
    .where(eq(orderItems.id, orderItemId));

  await ensureInboundPackageForOrderItem(orderItemId, receivedAt);

  const req = await getItemRequestById(row.orderItem.itemRequestId);
  if (req) {
    const payload = lineSnapshotPayloadFromItemRequest(req);
    try {
      await db.insert(itemRequestLineSnapshots).values({
        itemRequestId: row.orderItem.itemRequestId,
        phase: "warehouse_delivery_received",
        itemQuoteId: null,
        batchQuoteSessionId: null,
        auditMemo: JSON.stringify({
          kind: "customer_accepted_delivery_condition",
          orderItemId,
          condition,
        }),
        productUrl: payload.productUrl,
        productName: payload.productName,
        productSize: payload.productSize,
        productColor: payload.productColor,
        quantity: payload.quantity,
        note: `Customer accepted delivery condition (${conditionLabel}) and requested barrel packing.`,
        productImageUrl: payload.productImageUrl,
        siteName: payload.siteName,
      });
    } catch {
      /* snapshot optional */
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/barrels/assign-to-barrel");
  revalidatePath("/admin/barrels/assign-to-barrel-history");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/dashboard/barrels/product-to-barrel-history");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: `Accepted as ${conditionLabel}. Your product is queued for barrel assignment.`,
  };
}
