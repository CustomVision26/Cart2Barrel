"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequestLineSnapshots, orderItems, orders } from "@/db/schema";
import {
  orderItemFulfillmentCoreSelect,
  orderListSelect,
} from "@/data/order-list-select";
import { getItemRequestById } from "@/data/item-requests";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import {
  buildProductReturnTrackingAuditMemo,
  productReturnTrackingHumanNote,
} from "@/lib/product-return-tracking-memo";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { recordPurchaseTrackingUpdatedActivity } from "@/data/user-status-update-events";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { updateOrderItemPurchaseTrackingSchema } from "@/lib/validations/admin-order-item";
import { DELIVERY_RECEIVED_PROBLEM_FULFILLMENT_STATUSES } from "@/lib/warehouse-receipt-queue";

export type UpdatePurchaseTrackingState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function updateOrderItemPurchaseTrackingAction(
  raw: unknown,
): Promise<UpdatePurchaseTrackingState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = updateOrderItemPurchaseTrackingSchema.safeParse(raw);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.retailerTrackingCompany?.[0] ??
      parsed.error.flatten().fieldErrors.retailerTrackingNumber?.[0] ??
      parsed.error.flatten().fieldErrors.trackingUrl?.[0] ??
      parsed.error.flatten().fieldErrors.orderItemId?.[0];
    return {
      ok: false,
      message: first ?? "Invalid request.",
    };
  }

  const db = getDb();
  const [row] = await db
    .select({
      orderItem: orderItemFulfillmentCoreSelect,
      order: orderListSelect,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.id, parsed.data.orderItemId))
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
      message: "This line was refunded; tracking cannot be updated.",
    };
  }

  const effective = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const purpose = parsed.data.purpose ?? "inbound";

  if (
    effective === "product_return_awaiting_delivery" &&
    purpose !== "return"
  ) {
    return {
      ok: false,
      message:
        "This line is in product return. Use Return product to update return tracking.",
    };
  }

  const trackingEditable =
    effective === "company_purchase_pending_delivery" ||
    effective === "delivery_requested_pending_fulfillment" ||
    effective === "delivery_received_good_awaiting_barrel" ||
    effective === "delivery_received_item_missing" ||
    effective === "delivery_received_item_damaged" ||
    effective === "delivery_received_wrong_item" ||
    effective === "product_return_awaiting_delivery";
  if (!trackingEditable) {
    return {
      ok: false,
      message: "Tracking can only be edited after company purchase is recorded.",
    };
  }

  if (purpose === "return") {
    const returnAllowed =
      DELIVERY_RECEIVED_PROBLEM_FULFILLMENT_STATUSES.includes(effective) ||
      effective === "product_return_awaiting_delivery";
    if (!returnAllowed) {
      return {
        ok: false,
        message:
          "Return tracking can only be saved for lines with a problem receipt or an active product return.",
      };
    }
  }

  const url =
    parsed.data.trackingUrl === undefined ? null : parsed.data.trackingUrl;
  const company =
    parsed.data.retailerTrackingCompany === undefined ?
      null
    : parsed.data.retailerTrackingCompany;
  const number =
    parsed.data.retailerTrackingNumber === undefined ?
      null
    : parsed.data.retailerTrackingNumber;

  const nextFulfillment =
    purpose === "return" &&
    DELIVERY_RECEIVED_PROBLEM_FULFILLMENT_STATUSES.includes(effective) ?
      ("product_return_awaiting_delivery" as const)
    : undefined;

  await db
    .update(orderItems)
    .set({
      companyPurchaseTrackingUrl: url,
      companyPurchaseRetailerTrackingCompany: company,
      companyPurchaseRetailerTrackingNumber: number,
      companyPurchaseUpdatedByClerkUserId: cu.user.id,
      ...(nextFulfillment ? { fulfillmentStatus: nextFulfillment } : {}),
    })
    .where(eq(orderItems.id, row.orderItem.id));

  if (purpose === "return") {
    const req = await getItemRequestById(row.orderItem.itemRequestId);
    if (!req) {
      return { ok: false, message: "Request line not found for this order item." };
    }
    const payload = lineSnapshotPayloadFromItemRequest(req);
    const note = productReturnTrackingHumanNote({
      trackingUrl: url,
      retailerTrackingCompany: company,
      retailerTrackingNumber: number,
    });
    const auditMemo = buildProductReturnTrackingAuditMemo({
      orderItemId: row.orderItem.id,
      trackingUrl: url ?? undefined,
      retailerTrackingCompany: company ?? undefined,
      retailerTrackingNumber: number ?? undefined,
    });
    await db.insert(itemRequestLineSnapshots).values({
      itemRequestId: row.orderItem.itemRequestId,
      phase: "product_return_tracking_saved",
      itemQuoteId: null,
      batchQuoteSessionId: null,
      auditMemo,
      recordedByClerkUserId: cu.user.id,
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

  const reqForNotify = await getItemRequestById(row.orderItem.itemRequestId);
  const statusLabel =
    nextFulfillment === "product_return_awaiting_delivery" ?
      "return tracking saved"
    : "tracking updated";
  await recordPurchaseTrackingUpdatedActivity({
    clerkUserId: row.order.clerkUserId,
    orderId: row.order.id,
    orderItemId: row.orderItem.id,
    productName: reqForNotify?.productName ?? null,
    statusLabel,
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/dashboard/orders");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message:
      purpose === "return" ?
        "Return tracking saved; order status and audit trail updated."
      : "Tracking updated.",
  };
}
