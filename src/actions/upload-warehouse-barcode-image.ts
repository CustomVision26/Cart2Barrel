"use server";

import { put } from "@vercel/blob";
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
import {
  canManageRetailerReceiptImages,
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type UploadWarehouseBarcodeImageState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

function collectFilesFromFormData(formData: FormData): File[] {
  const raw = formData.getAll("file");
  return raw.filter((v): v is File => v instanceof File && v.size > 0);
}

export async function uploadWarehouseBarcodeImageAction(
  formData: FormData,
): Promise<UploadWarehouseBarcodeImageState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const orderItemIdRaw = formData.get("orderItemId");
  if (typeof orderItemIdRaw !== "string" || orderItemIdRaw.trim() === "") {
    return { ok: false, message: "Missing order line." };
  }
  const orderItemId = orderItemIdRaw.trim();

  const files = collectFilesFromFormData(formData);
  if (files.length !== 1) {
    return { ok: false, message: "Choose exactly one image." };
  }
  const file = files[0]!;

  if (!isRetailerReceiptImageMime(file.type)) {
    return {
      ok: false,
      message: "Only JPEG, PNG, WebP, and GIF images are allowed.",
    };
  }
  if (file.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: `Each image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

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
        "A barcode photo cannot be uploaded for this line in its current state.",
    };
  }

  let imageUrl: string;
  try {
    const ext = retailerReceiptExtensionForMime(file.type);
    const pathname = `warehouse-barcodes/${orderItemId}/${crypto.randomUUID()}.${ext}`;
    const blob = await put(pathname, file, {
      access: "public",
      token,
      contentType: file.type || undefined,
    });
    imageUrl = blob.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { ok: false, message: msg };
  }

  await db
    .update(orderItems)
    .set({ warehouseReceivedBarcodeImageUrl: imageUrl })
    .where(eq(orderItems.id, orderItemId));

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/orders");
  revalidateDashboardAddItem();

  return { ok: true, imageUrl };
}
