"use server";

import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { itemRequests } from "@/db/schema";
import { getItemRequestById } from "@/data/item-requests";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type AdminUploadItemRequestProductImageState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

function collectFilesFromFormData(formData: FormData): File[] {
  const raw = formData.getAll("file");
  return raw.filter((v): v is File => v instanceof File && v.size > 0);
}

export async function adminUploadItemRequestProductImageAction(
  formData: FormData,
): Promise<AdminUploadItemRequestProductImageState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const itemRequestIdRaw = formData.get("itemRequestId");
  if (typeof itemRequestIdRaw !== "string" || itemRequestIdRaw.trim() === "") {
    return { ok: false, message: "Missing item request." };
  }
  const itemRequestId = itemRequestIdRaw.trim();
  const persistRaw = formData.get("persistToRequest");
  const persistToRequest = persistRaw !== "false" && persistRaw !== "0";

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

  const req = await getItemRequestById(itemRequestId);
  if (!req) {
    return { ok: false, message: "Item request not found." };
  }

  let imageUrl: string;
  try {
    const ext = retailerReceiptExtensionForMime(file.type);
    const pathname = `product-images/${itemRequestId}/${crypto.randomUUID()}.${ext}`;
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

  if (persistToRequest) {
    const db = getDb();
    await db
      .update(itemRequests)
      .set({ productImageUrl: imageUrl })
      .where(eq(itemRequests.id, itemRequestId));

    revalidatePath("/admin/item-requests", "layout");
    revalidatePath("/admin/overview");
    revalidatePath("/admin/barrels/assign-to-barrel");
    revalidatePath("/dashboard/items");
    revalidateDashboardAddItem();
    revalidatePath("/dashboard/cart");
    revalidatePath("/dashboard/barrels/product-to-barrel");
  }

  return { ok: true, imageUrl };
}
