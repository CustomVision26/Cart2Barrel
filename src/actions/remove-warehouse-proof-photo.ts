"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

const removeWarehouseProofPhotoSchema = z.object({
  orderItemId: z.string().uuid(),
  imageUrl: z.string().url(),
});

export type RemoveWarehouseProofPhotoState =
  | { ok: true; message: string; allUrls: string[] }
  | { ok: false; message: string };

export async function removeWarehouseProofPhotoAction(
  input: z.infer<typeof removeWarehouseProofPhotoSchema>,
): Promise<RemoveWarehouseProofPhotoState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = removeWarehouseProofPhotoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { orderItemId, imageUrl } = parsed.data;

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

  if (!canManageRetailerReceiptImages(row.orderItem, row.order)) {
    return {
      ok: false,
      message: "Proof photos cannot be changed for this line in its current state.",
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
    return { ok: false, message: "This line was refunded." };
  }

  const existing = row.orderItem.warehouseReceivedProofPhotoUrls ?? [];
  const allUrls = existing.filter((u) => u !== imageUrl);
  if (allUrls.length === existing.length) {
    return { ok: false, message: "Photo not found on this line." };
  }

  await db
    .update(orderItems)
    .set({
      warehouseReceivedProofPhotoUrls: allUrls.length > 0 ? allUrls : null,
      warehouseReceivedProofPhotoCount: allUrls.length,
    })
    .where(eq(orderItems.id, orderItemId));

  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  revalidateDashboardAddItem();

  return { ok: true, message: "Proof photo removed.", allUrls };
}
