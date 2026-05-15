"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import {
  orderItemFulfillmentCoreSelectWithWarehouse,
  orderListSelect,
} from "@/data/order-list-select";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { canManageRetailerReceiptImages } from "@/lib/retailer-receipt-images";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { warehouseBarcodeImageOrderItemSchema } from "@/lib/validations/warehouse-barcode-image";

export type RemoveWarehouseBarcodeImageState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function removeWarehouseBarcodeImageAction(
  raw: unknown,
): Promise<RemoveWarehouseBarcodeImageState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = warehouseBarcodeImageOrderItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }
  const orderItemId = parsed.data.orderItemId;

  const db = getDb();
  const [row] = await db
    .select({
      orderItem: orderItemFulfillmentCoreSelectWithWarehouse,
      order: orderListSelect,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!row || row.order.status !== "paid") {
    return { ok: false, message: "Order line not found." };
  }

  const admin = isClerkAdmin(cu.user);
  if (!admin && row.order.clerkUserId !== cu.user.id) {
    return { ok: false, message: "You cannot update this order line." };
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
      message:
        "The barcode photo cannot be changed for this line in its current state.",
    };
  }

  if (!row.orderItem.warehouseReceivedBarcodeImageUrl?.trim()) {
    return { ok: false, message: "There is no barcode photo on this line." };
  }

  await db
    .update(orderItems)
    .set({ warehouseReceivedBarcodeImageUrl: null })
    .where(eq(orderItems.id, orderItemId));

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/orders");
  revalidateDashboardAddItem();

  return { ok: true, message: "Barcode photo removed." };
}
