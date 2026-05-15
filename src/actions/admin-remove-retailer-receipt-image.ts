"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { orderItemFulfillmentCoreSelect, orderListSelect } from "@/data/order-list-select";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  canManageRetailerReceiptImages,
} from "@/lib/retailer-receipt-images";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { removeRetailerReceiptImageSchema } from "@/lib/validations/admin-order-item";

export type RemoveRetailerReceiptImageState =
  | { ok: true; message: string; allUrls: string[] }
  | { ok: false; message: string };

export async function removeAdminRetailerReceiptImageAction(
  raw: unknown,
): Promise<RemoveRetailerReceiptImageState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = removeRetailerReceiptImageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
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
    return { ok: false, message: "This line was refunded." };
  }

  if (!canManageRetailerReceiptImages(row.orderItem, row.order)) {
    return {
      ok: false,
      message: "Receipt images cannot be changed for this line in its current state.",
    };
  }

  const existing = row.orderItem.companyPurchaseReceiptImageUrls ?? [];
  const target = parsed.data.imageUrl.trim();
  if (!existing.includes(target)) {
    return { ok: false, message: "That image is not attached to this line." };
  }
  const next = existing.filter((u) => u !== target);
  const allUrls = next.length > 0 ? next : [];

  await db
    .update(orderItems)
    .set({
      companyPurchaseReceiptImageUrls: allUrls.length > 0 ? allUrls : null,
    })
    .where(eq(orderItems.id, row.orderItem.id));

  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/dashboard/orders");
  revalidateDashboardAddItem();

  return { ok: true, message: "Receipt image removed.", allUrls };
}
