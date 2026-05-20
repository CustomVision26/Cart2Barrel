"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import { setCustomsDeclarationFormUrl } from "@/data/barrel-outbound-shipment-tracking";
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
import { z } from "zod";

const barrelIdSchema = z.string().uuid();

export type AdminUploadCustomsDeclarationFormState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

export async function adminUploadCustomsDeclarationFormAction(
  formData: FormData,
): Promise<AdminUploadCustomsDeclarationFormState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
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
  const barrelId = parsedId.data;

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

  let imageUrl: string;
  try {
    const ext = retailerReceiptExtensionForMime(file.type);
    const pathname = `customs-forms/${barrelId}/${crypto.randomUUID()}.${ext}`;
    const blob = await put(pathname, file, {
      access: "public",
      token,
      contentType: file.type || undefined,
    });
    imageUrl = blob.url;
  } catch {
    return { ok: false, message: "Upload failed. Try again." };
  }

  await setCustomsDeclarationFormUrl(barrelId, imageUrl);

  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");

  return { ok: true, imageUrl };
}
