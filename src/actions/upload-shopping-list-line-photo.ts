"use server";

import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";

import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type UploadShoppingListLinePhotoState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

export async function uploadShoppingListLinePhotoAction(
  raw: unknown,
): Promise<UploadShoppingListLinePhotoState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to upload a photo." };
  }
  if (!(raw instanceof FormData)) {
    return { ok: false, message: "Choose a product photo." };
  }
  const file = raw.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a product photo." };
  }
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

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const ext = retailerReceiptExtensionForMime(file.type);
  try {
    const blob = await put(
      `shopping-list-line-photos/${userId}/${crypto.randomUUID()}.${ext}`,
      file,
      {
        access: "public",
        token,
        contentType: file.type || undefined,
      },
    );
    return { ok: true, imageUrl: blob.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { ok: false, message: msg };
  }
}
