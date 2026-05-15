"use server";

import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { itemRequests } from "@/db/schema";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { getItemRequestById } from "@/data/item-requests";
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

export type UploadItemRequestProductImageState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

function collectFilesFromFormData(formData: FormData): File[] {
  const raw = formData.getAll("file");
  return raw.filter((v): v is File => v instanceof File && v.size > 0);
}

export async function uploadItemRequestProductImageAction(
  formData: FormData,
): Promise<UploadItemRequestProductImageState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to upload an image." };
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
  const req = await getItemRequestById(itemRequestId);
  if (!req || req.clerkUserId !== userId) {
    return { ok: false, message: "You cannot update this request." };
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

  await db
    .update(itemRequests)
    .set({ productImageUrl: imageUrl })
    .where(eq(itemRequests.id, itemRequestId));

  const snapLine = lineSnapshotPayloadFromItemRequest({
    ...req,
    productImageUrl: imageUrl,
  });
  await insertItemRequestLineSnapshot({
    itemRequestId,
    phase: "customer_line_edit",
    auditMemo: "Customer uploaded a product photo (stored on Vercel Blob).",
    line: snapLine,
  });

  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard");

  return { ok: true, imageUrl };
}
