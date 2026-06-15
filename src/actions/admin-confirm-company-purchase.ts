"use server";

import { eq } from "drizzle-orm";

import { applyCompanyPurchaseStorePickup } from "@/data/apply-company-purchase-store-pickup";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import {
  orderItemFulfillmentCoreSelect,
  orderListSelect,
} from "@/data/order-list-select";
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
import { ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE } from "@/lib/checkout-snapshot-kind";
import { COMPANY_PURCHASE_INBOUND_SHIPMENT } from "@/lib/company-purchase-inbound";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { revalidateCompanyPurchasePaths } from "@/lib/revalidate-company-purchase-paths";
import {
  confirmCompanyPurchaseSchema,
  type ConfirmCompanyPurchaseTrackingInput,
} from "@/lib/validations/admin-order-item";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { recordCompanyPurchaseConfirmedActivity } from "@/data/user-status-update-events";

export type ConfirmCompanyPurchaseState =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function confirmCompanyPurchaseTracking(
  data: ConfirmCompanyPurchaseTrackingInput,
  adminClerkUserId: string,
): Promise<ConfirmCompanyPurchaseState> {
  const db = getDb();
  const [row] = await db
    .select({
      orderItem: orderItemFulfillmentCoreSelect,
      order: orderListSelect,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.id, data.orderItemId))
    .limit(1);

  if (!row || row.order.status !== "paid") {
    return { ok: false, message: "Order line not found." };
  }

  let refunded = 0;
  try {
    const refundedMap = await sumRefundedCentsByOrderItemIds([row.orderItem.id]);
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

  await db
    .update(orderItems)
    .set({
      fulfillmentStatus: "company_purchase_pending_delivery",
      companyPurchaseInboundMethod: COMPANY_PURCHASE_INBOUND_SHIPMENT,
      storePickupAt: null,
      companyPurchaseTrackingUrl: data.trackingUrl ?? null,
      companyPurchaseRetailerTrackingCompany: data.retailerTrackingCompany ?? null,
      companyPurchaseRetailerTrackingNumber: data.retailerTrackingNumber ?? null,
      companyPurchaseUpdatedByClerkUserId: adminClerkUserId,
    })
    .where(eq(orderItems.id, row.orderItem.id));

  const quote = await getLatestQuoteForItemRequest(row.orderItem.itemRequestId);
  if (quote) {
    const timelineQuote = await insertCheckoutTimelineQuote({
      itemRequestId: row.orderItem.itemRequestId,
      sourceQuote: quote,
      checkoutSnapshotKind: ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE,
    });
    const req = await getItemRequestById(row.orderItem.itemRequestId);
    if (req) {
      await insertItemRequestLineSnapshot({
        itemRequestId: row.orderItem.itemRequestId,
        phase: "company_purchase_pending_delivery",
        itemQuoteId: timelineQuote.id,
        recordedByClerkUserId: adminClerkUserId,
        line: lineSnapshotPayloadFromItemRequest(req),
      });
    }
  }

  const reqForNotify = await getItemRequestById(row.orderItem.itemRequestId);
  await recordCompanyPurchaseConfirmedActivity({
    clerkUserId: row.order.clerkUserId,
    orderId: row.order.id,
    orderItemId: row.orderItem.id,
    productName: reqForNotify?.productName ?? null,
  });

  return { ok: true, message: "Recorded company purchase for this line." };
}

export async function confirmCompanyPurchaseAction(
  raw: unknown,
): Promise<ConfirmCompanyPurchaseState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = confirmCompanyPurchaseSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return {
      ok: false,
      message: first ?? "Invalid request.",
    };
  }

  const result =
    parsed.data.deliveryMode === "store_pickup" ?
      await applyCompanyPurchaseStorePickup(parsed.data, cu.user.id)
    : await confirmCompanyPurchaseTracking(parsed.data, cu.user.id);

  if (result.ok) {
    revalidateCompanyPurchasePaths();
  }

  return result;
}
