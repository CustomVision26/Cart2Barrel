"use server";

import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  countHubStockProductImages,
  createHubStockProduct,
  deleteHubStockProduct,
  deleteHubStockProductImage,
  getHubStockProductById,
  insertHubStockProductImages,
  setHubStockProductPublished,
  updateHubStockProduct,
} from "@/data/hub-stock-products";
import {
  deleteHubShipFromAddress,
  setPrimaryHubShipFromAddress,
  upsertHubShipFromAddress,
} from "@/data/hub-ship-from";
import {
  HUB_STOCK_PRODUCT_IMAGES_MAX,
  HUB_STOCK_PRODUCT_IMAGE_UPLOAD_BATCH_MAX,
} from "@/lib/hub-stock";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import {
  adminCreateHubStockProductSchema,
  adminDeleteHubStockProductImageSchema,
  adminDeleteHubStockProductSchema,
  adminSetHubStockProductPublishedSchema,
  adminUpdateHubStockProductSchema,
  adminUploadHubStockProductImagesSchema,
  adminHubShipFromIdSchema,
  adminHubShipFromSchema,
  hubStockPriceUsdToCents,
} from "@/lib/validations/hub-stock";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type AdminHubStockMutationState =
  | { ok: true }
  | { ok: false; message: string };

export type AdminHubStockCreateState =
  | { ok: true; id: string }
  | { ok: false; message: string };

export type AdminUploadHubStockImagesState =
  | { ok: true; uploaded: number }
  | { ok: false; message: string };

function revalidateHubStockAdmin(): void {
  revalidatePath("/admin/overview");
  revalidatePath("/");
  revalidatePath("/dashboard/cart");
}

function collectFilesFromFormData(formData: FormData): File[] {
  const raw = formData.getAll("file");
  return raw.filter((v): v is File => v instanceof File && v.size > 0);
}

export async function adminCreateHubStockProductAction(
  input: unknown,
): Promise<AdminHubStockCreateState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminCreateHubStockProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const cents = hubStockPriceUsdToCents(parsed.data.priceUsd);
  if (cents < 50) {
    return { ok: false, message: "Price must be at least $0.50 USD (Stripe minimum per line)." };
  }

  const created = await createHubStockProduct({
    name: parsed.data.name,
    sizeLabel: parsed.data.sizeLabel,
    colorLabel: parsed.data.colorLabel,
    description: parsed.data.description ?? "",
    priceUsdCents: cents,
    stockQty: parsed.data.stockQty,
    parcelWeightOz: parsed.data.parcelWeightOz,
    parcelLengthIn: parsed.data.parcelLengthIn,
    parcelWidthIn: parsed.data.parcelWidthIn,
    parcelHeightIn: parsed.data.parcelHeightIn,
    isActive: parsed.data.isActive ?? false,
    createdByClerkUserId: user.id,
  });
  revalidateHubStockAdmin();
  return { ok: true, id: created.id };
}

export async function adminUpdateHubStockProductAction(
  input: unknown,
): Promise<AdminHubStockMutationState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminUpdateHubStockProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const cents = hubStockPriceUsdToCents(parsed.data.priceUsd);
  if (cents < 50) {
    return { ok: false, message: "Price must be at least $0.50 USD (Stripe minimum per line)." };
  }

  const updated = await updateHubStockProduct({
    id: parsed.data.id,
    name: parsed.data.name,
    sizeLabel: parsed.data.sizeLabel,
    colorLabel: parsed.data.colorLabel,
    description: parsed.data.description ?? "",
    priceUsdCents: cents,
    stockQty: parsed.data.stockQty,
    parcelWeightOz: parsed.data.parcelWeightOz,
    parcelLengthIn: parsed.data.parcelLengthIn,
    parcelWidthIn: parsed.data.parcelWidthIn,
    parcelHeightIn: parsed.data.parcelHeightIn,
    isActive: parsed.data.isActive ?? true,
  });
  if (!updated) {
    return { ok: false, message: "Product not found." };
  }
  revalidateHubStockAdmin();
  return { ok: true };
}

export async function adminSetHubStockProductPublishedAction(
  input: unknown,
): Promise<AdminHubStockMutationState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminSetHubStockProductPublishedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const updated = await setHubStockProductPublished(
    parsed.data.id,
    parsed.data.published,
  );
  if (!updated) {
    return { ok: false, message: "Product not found." };
  }
  revalidateHubStockAdmin();
  return { ok: true };
}

export async function adminDeleteHubStockProductAction(
  input: unknown,
): Promise<AdminHubStockMutationState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminDeleteHubStockProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const deleted = await deleteHubStockProduct(parsed.data.id);
  if (!deleted) {
    return { ok: false, message: "Product not found." };
  }
  revalidateHubStockAdmin();
  return { ok: true };
}

/** Multipart image upload for an in-hub catalog SKU. */
export async function adminUploadHubStockProductImagesAction(
  input: unknown,
): Promise<AdminUploadHubStockImagesState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  if (!(input instanceof FormData)) {
    return { ok: false, message: "Invalid upload payload." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const parsed = adminUploadHubStockProductImagesSchema.safeParse({
    productId: input.get("productId"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Missing product id." };
  }
  const productId = parsed.data.productId;

  const files = collectFilesFromFormData(input);
  if (files.length === 0) {
    return { ok: false, message: "Choose at least one image." };
  }
  if (files.length > HUB_STOCK_PRODUCT_IMAGE_UPLOAD_BATCH_MAX) {
    return {
      ok: false,
      message: `Upload at most ${HUB_STOCK_PRODUCT_IMAGE_UPLOAD_BATCH_MAX} images at a time.`,
    };
  }

  const product = await getHubStockProductById(productId);
  if (!product) {
    return { ok: false, message: "Product not found." };
  }

  const existingCount = await countHubStockProductImages(productId);
  if (existingCount + files.length > HUB_STOCK_PRODUCT_IMAGES_MAX) {
    return {
      ok: false,
      message: `At most ${HUB_STOCK_PRODUCT_IMAGES_MAX} images per product.`,
    };
  }

  const imageUrls: string[] = [];
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
    const ext = retailerReceiptExtensionForMime(file.type);
    const pathname = `hub-stock/${productId}/${randomUUID()}.${ext}`;
    try {
      const blob = await put(pathname, file, {
        access: "public",
        token,
        contentType: file.type || undefined,
      });
      imageUrls.push(blob.url);
    } catch {
      return { ok: false, message: "Image upload failed. Try again." };
    }
  }

  await insertHubStockProductImages(productId, imageUrls);
  revalidateHubStockAdmin();
  return { ok: true, uploaded: imageUrls.length };
}

export async function adminDeleteHubStockProductImageAction(
  input: unknown,
): Promise<AdminHubStockMutationState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminDeleteHubStockProductImageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const deleted = await deleteHubStockProductImage(parsed.data.imageId);
  if (!deleted) {
    return { ok: false, message: "Image not found." };
  }
  revalidateHubStockAdmin();
  return { ok: true };
}

export async function adminSaveHubShipFromAction(
  input: unknown,
): Promise<AdminHubStockMutationState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminHubShipFromSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid address." };
  }
  try {
    await upsertHubShipFromAddress({
      ...parsed.data,
      line2: parsed.data.line2 ?? "",
      isPrimary: parsed.data.isPrimary ?? false,
      updatedByClerkUserId: user.id,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not save the ship-from address.",
    };
  }
  revalidateHubStockAdmin();
  return { ok: true };
}

export async function adminSetHubShipFromPrimaryAction(
  input: unknown,
): Promise<AdminHubStockMutationState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminHubShipFromIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid address." };
  }
  const ok = await setPrimaryHubShipFromAddress(parsed.data.id);
  if (!ok) {
    return { ok: false, message: "Address not found." };
  }
  revalidateHubStockAdmin();
  return { ok: true };
}

export async function adminDeleteHubShipFromAction(
  input: unknown,
): Promise<AdminHubStockMutationState> {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminHubShipFromIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid address." };
  }
  const result = await deleteHubShipFromAddress(parsed.data.id);
  if (!result.ok) {
    return result;
  }
  revalidateHubStockAdmin();
  return { ok: true };
}
