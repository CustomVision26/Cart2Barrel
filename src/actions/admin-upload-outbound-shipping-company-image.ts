"use server";

import { put } from "@vercel/blob";
import { z } from "zod";

import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type AdminOutboundShippingCompanyImageState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

const barrelIdSchema = z.string().uuid();

export async function adminUploadOutboundShippingCompanyImageAction(
  formData: FormData,
): Promise<AdminOutboundShippingCompanyImageState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "Admin access required." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const barrelIdRaw = formData.get("barrelId");
  const parsedId = barrelIdSchema.safeParse(
    typeof barrelIdRaw === "string" ? barrelIdRaw.trim() : "",
  );
  if (!parsedId.success) {
    return { ok: false, message: "Missing container." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
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
      message: `Image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  try {
    const ext = retailerReceiptExtensionForMime(file.type);
    const pathname = `outbound-shipping-company/${parsedId.data}/${crypto.randomUUID()}.${ext}`;
    const blob = await put(pathname, file, {
      access: "public",
      token,
      contentType: file.type || undefined,
    });
    return { ok: true, imageUrl: blob.url };
  } catch {
    return { ok: false, message: "Upload failed. Try again." };
  }
}
