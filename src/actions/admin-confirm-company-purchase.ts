"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { orderListSelect } from "@/data/order-list-select";
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
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { confirmCompanyPurchaseSchema } from "@/lib/validations/admin-order-item";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type ConfirmCompanyPurchaseState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function confirmCompanyPurchaseAction(
  raw: unknown
): Promise<ConfirmCompanyPurchaseState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = confirmCompanyPurchaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      orderItem: orderItems,
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
      message: "This line was refunded and cannot be marked as purchased.",
    };
  }

  const effectiveFulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order
  );
  if (effectiveFulfillment !== "paid_pending_company_purchase") {
    return {
      ok: false,
      message: "This product is not awaiting company purchase.",
    };
  }

  await db
    .update(orderItems)
    .set({ fulfillmentStatus: "company_purchase_pending_delivery" })
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
        line: lineSnapshotPayloadFromItemRequest(req),
      });
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/item-requests");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/items/new");

  return { ok: true, message: "Recorded company purchase for this line." };
}
