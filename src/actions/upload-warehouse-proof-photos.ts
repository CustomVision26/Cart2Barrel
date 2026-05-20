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
  RETAILER_RECEIPT_IMAGES_MAX,
  RETAILER_RECEIPT_UPLOAD_BATCH_MAX,
} from "@/lib/retailer-receipt-images";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type UploadWarehouseProofPhotosState =
  | { ok: true; newUrls: string[]; allUrls: string[] }
  | { ok: false; message: string };

function collectFilesFromFormData(formData: FormData): File[] {
  const raw = formData.getAll("files");
  return raw.filter((v): v is File => v instanceof File && v.size > 0);
}

export async function uploadWarehouseProofPhotosAction(
  formData: FormData,
): Promise<UploadWarehouseProofPhotosState> {
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
  if (files.length === 0) {
    return { ok: false, message: "Choose at least one image." };
  }
  if (files.length > RETAILER_RECEIPT_UPLOAD_BATCH_MAX) {
    return {
      ok: false,
      message: `Upload at most ${RETAILER_RECEIPT_UPLOAD_BATCH_MAX} images at a time.`,
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
      message: "Proof photos cannot be uploaded for this line in its current state.",
    };
  }

  const existing = row.orderItem.warehouseReceivedProofPhotoUrls ?? [];
  if (existing.length + files.length > RETAILER_RECEIPT_IMAGES_MAX) {
    return {
      ok: false,
      message: `At most ${RETAILER_RECEIPT_IMAGES_MAX} proof photos per line.`,
    };
  }

  for (const file of files) {
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
  }

  const newUrls: string[] = [];
  try {
    for (const file of files) {
      const ext = retailerReceiptExtensionForMime(file.type);
      const pathname = `warehouse-proof-photos/${orderItemId}/${crypto.randomUUID()}.${ext}`;
      const blob = await put(pathname, file, {
        access: "public",
        token,
        contentType: file.type || undefined,
      });
      newUrls.push(blob.url);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { ok: false, message: msg };
  }

  const allUrls = [...existing, ...newUrls];

  await db
    .update(orderItems)
    .set({
      warehouseReceivedProofPhotoUrls: allUrls,
      warehouseReceivedProofPhotoCount: allUrls.length,
    })
    .where(eq(orderItems.id, orderItemId));

  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard", "layout");
  revalidateDashboardAddItem();

  return { ok: true, newUrls, allUrls };
}
