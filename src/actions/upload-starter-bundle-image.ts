"use server";

import { put } from "@vercel/blob";
import { currentUser } from "@clerk/nextjs/server";

import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type UploadStarterBundleImageState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

export async function uploadStarterBundleImageAction(
  raw: unknown,
): Promise<UploadStarterBundleImageState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access is required." };
  }
  if (!(raw instanceof FormData)) {
    return { ok: false, message: "Choose a bundle image." };
  }
  const file = raw.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a bundle image." };
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
      `starter-bundle-images/${user.id}/${crypto.randomUUID()}.${ext}`,
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
