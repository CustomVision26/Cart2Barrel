"use server";

import { put } from "@vercel/blob";

import { getItemRequestById } from "@/data/item-requests";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  isOutOfStockAttachmentImageMime,
  OUT_OF_STOCK_ATTACHMENT_IMAGE_MAX_BYTES,
  OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX,
  OUT_OF_STOCK_ATTACHMENT_UPLOAD_BATCH_MAX,
  outOfStockAttachmentExtensionForMime,
} from "@/lib/out-of-stock-staff-attachments";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type UploadOutOfStockAttachmentImagesState =
  | { ok: true; urls: string[] }
  | { ok: false; message: string };

function collectFilesFromFormData(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function uploadAdminOutOfStockAttachmentImagesAction(
  formData: FormData,
): Promise<UploadOutOfStockAttachmentImagesState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const itemRequestIdRaw = formData.get("itemRequestId");
  if (typeof itemRequestIdRaw !== "string" || itemRequestIdRaw.trim() === "") {
    return { ok: false, message: "Missing product request." };
  }
  const itemRequestId = itemRequestIdRaw.trim();

  const row = await getItemRequestById(itemRequestId);
  if (!row) {
    return { ok: false, message: "Product request not found." };
  }
  if (row.status !== "pending" && row.status !== "quoted") {
    return {
      ok: false,
      message: "Attachments can only be added before marking out of stock.",
    };
  }

  const files = collectFilesFromFormData(formData);
  if (files.length === 0) {
    return { ok: false, message: "Choose at least one image." };
  }
  if (files.length > OUT_OF_STOCK_ATTACHMENT_UPLOAD_BATCH_MAX) {
    return {
      ok: false,
      message: `Upload at most ${OUT_OF_STOCK_ATTACHMENT_UPLOAD_BATCH_MAX} images at a time.`,
    };
  }
  if (files.length > OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX) {
    return {
      ok: false,
      message: `At most ${OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX} attachment images per product.`,
    };
  }

  for (const file of files) {
    if (!isOutOfStockAttachmentImageMime(file.type)) {
      return {
        ok: false,
        message: "Only JPEG, PNG, WebP, and GIF images are allowed.",
      };
    }
    if (file.size > OUT_OF_STOCK_ATTACHMENT_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        message: `Each image must be at most ${Math.round(OUT_OF_STOCK_ATTACHMENT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
      };
    }
  }

  const urls: string[] = [];
  try {
    for (const file of files) {
      const ext = outOfStockAttachmentExtensionForMime(file.type);
      const pathname = `out-of-stock-attachments/${itemRequestId}/${crypto.randomUUID()}.${ext}`;
      const blob = await put(pathname, file, {
        access: "public",
        token,
        contentType: file.type || undefined,
      });
      urls.push(blob.url);
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Upload failed.";
    const msg =
      raw.toLowerCase().includes("network") ?
        "Could not reach file storage. Check your connection and that BLOB_READ_WRITE_TOKEN is set."
      : raw;
    return { ok: false, message: msg };
  }

  return { ok: true, urls };
}
