"use server";

import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";

import type {
  AdminSpotlightProductMutationState,
  AdminUploadSpotlightProductImageState,
} from "@/actions/admin-spotlight-products";
import {
  deleteSpotlightVariantsByParentId,
  getSpotlightVariantById,
  insertSpotlightVariants,
  nextSpotlightVariantSortIndex,
  updateSpotlightVariantImage,
} from "@/data/spotlight-product-variants";
import { getSpotlightProductById } from "@/data/spotlight-category-products";
import { getDb } from "@/db";
import { spotlightProductVariants } from "@/db/schema";
import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import { resolveSpotlightProductPreviewImage } from "@/lib/spotlight-product-preview";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";
import {
  adminCreateSpotlightVariantSchema,
  adminDeleteSpotlightVariantSchema,
  adminImportSpotlightVariantsSchema,
  adminRefreshSpotlightVariantImageSchema,
  adminSetSpotlightVariantImageUrlSchema,
  adminUpdateSpotlightVariantSchema,
  spotlightVariantFieldsFromInput,
} from "@/lib/validations/spotlight-product-variant";

function revalidateSpotlightPaths(): void {
  revalidatePath("/");
  revalidatePath("/admin/spotlight-products");
}

export async function adminImportSpotlightVariantsAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminImportSpotlightVariantsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const parent = await getSpotlightProductById(parsed.data.parentProductId);
  if (!parent) {
    return { ok: false, message: "Parent product not found." };
  }

  const result = await fetchProductVariants({
    productUrl: parent.productUrl,
    productName: parent.label?.trim() || undefined,
    productSize: parent.productSize ?? undefined,
    productColor: parent.productColor ?? undefined,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  if (parsed.data.replaceExisting) {
    await deleteSpotlightVariantsByParentId(parent.id);
  }

  let sortBase = await nextSpotlightVariantSortIndex(parent.id);
  const rows = result.variants.map((v) => ({
    productUrl:
      v.productUrl && v.productUrl !== parent.productUrl ? v.productUrl : null,
    imageUrl: v.imageUrl,
    priceUsdCents: v.priceUsdCents,
    productSize: v.size,
    productColor: v.color,
    packLabel: v.packLabel,
    label: v.label,
    sortIndex: sortBase++,
  }));

  const inserted = await insertSpotlightVariants(parent.id, rows);
  revalidateSpotlightPaths();

  return {
    ok: true,
    message: `Imported ${inserted} variant${inserted === 1 ? "" : "s"} (${result.method}).`,
  };
}

export async function adminCreateSpotlightVariantAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminCreateSpotlightVariantSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const parent = await getSpotlightProductById(parsed.data.parentProductId);
  if (!parent) {
    return { ok: false, message: "Parent product not found." };
  }

  const fields = spotlightVariantFieldsFromInput(parsed.data);
  const sortIndex = await nextSpotlightVariantSortIndex(parent.id);
  const db = getDb();
  await db.insert(spotlightProductVariants).values({
    parentProductId: parent.id,
    label: fields.label,
    priceUsdCents: fields.priceUsdCents,
    productSize: fields.productSize,
    productColor: fields.productColor,
    packLabel: fields.packLabel,
    productUrl: fields.productUrl,
    imageUrl: fields.imageUrl,
    sortIndex,
    isActive: true,
  });

  revalidateSpotlightPaths();
  return { ok: true, message: "Variant added." };
}

export async function adminUpdateSpotlightVariantAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminUpdateSpotlightVariantSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const row = await getSpotlightVariantById(parsed.data.id);
  if (!row) {
    return { ok: false, message: "Variant not found." };
  }

  const fields = spotlightVariantFieldsFromInput({
    label: parsed.data.label,
    priceUsd: parsed.data.priceUsd,
    productSize: parsed.data.productSize,
    productColor: parsed.data.productColor,
    packLabel: parsed.data.packLabel,
    productUrl: parsed.data.productUrl,
  });

  const db = getDb();
  await db
    .update(spotlightProductVariants)
    .set({
      label: fields.label,
      priceUsdCents: fields.priceUsdCents,
      productSize: fields.productSize,
      productColor: fields.productColor,
      packLabel: fields.packLabel,
      productUrl: fields.productUrl,
      isActive: parsed.data.isActive,
    })
    .where(eq(spotlightProductVariants.id, parsed.data.id));

  revalidateSpotlightPaths();
  return { ok: true, message: "Variant updated." };
}

export async function adminDeleteSpotlightVariantAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminDeleteSpotlightVariantSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const db = getDb();
  await db
    .delete(spotlightProductVariants)
    .where(eq(spotlightProductVariants.id, parsed.data.id));

  revalidateSpotlightPaths();
  return { ok: true, message: "Variant removed." };
}

export async function adminRefreshSpotlightVariantImageAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminRefreshSpotlightVariantImageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const variant = await getSpotlightVariantById(parsed.data.id);
  if (!variant) {
    return { ok: false, message: "Variant not found." };
  }

  const parent = await getSpotlightProductById(variant.parentProductId);
  if (!parent) {
    return { ok: false, message: "Parent product not found." };
  }

  const fetchUrl =
    variant.productUrl?.trim() && /^https:\/\//i.test(variant.productUrl.trim())
      ? variant.productUrl.trim()
      : parent.productUrl;

  let imageUrl: string | null = null;
  try {
    imageUrl = await resolveSpotlightProductPreviewImage(fetchUrl);
  } catch {
    imageUrl = null;
  }

  await updateSpotlightVariantImage(parsed.data.id, imageUrl);
  revalidateSpotlightPaths();

  if (!imageUrl) {
    return {
      ok: false,
      message:
        "Could not fetch a preview image. Upload an image manually or paste an https image URL.",
    };
  }
  return { ok: true, message: "Variant preview image updated." };
}

/** Multipart upload for variant preview when auto-fetch failed or missing. */
export async function adminUploadSpotlightVariantImageAction(
  formData: FormData,
): Promise<AdminUploadSpotlightProductImageState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const variantIdRaw = formData.get("variantId");
  if (typeof variantIdRaw !== "string" || !variantIdRaw.trim()) {
    return { ok: false, message: "Missing variant id." };
  }
  const variantId = variantIdRaw.trim();

  const fileRaw = formData.get("file");
  if (!(fileRaw instanceof File) || fileRaw.size === 0) {
    return { ok: false, message: "Choose an image file." };
  }

  const variant = await getSpotlightVariantById(variantId);
  if (!variant) {
    return { ok: false, message: "Variant not found." };
  }

  const replace = formData.get("replace") === "true";
  if (variant.imageUrl && !replace) {
    return {
      ok: false,
      message:
        "This variant already has an image. Upload again with replace enabled, or use Refresh image.",
    };
  }

  if (!isRetailerReceiptImageMime(fileRaw.type)) {
    return {
      ok: false,
      message: "Only JPEG, PNG, WebP, and GIF images are allowed.",
    };
  }
  if (fileRaw.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: `Image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const ext = retailerReceiptExtensionForMime(fileRaw.type);
  const pathname = `spotlight-products/${variant.parentProductId}/variants/${variantId}/${randomUUID()}.${ext}`;
  let imageUrl: string;
  try {
    const blob = await put(pathname, fileRaw, {
      access: "public",
      token,
      contentType: fileRaw.type || undefined,
    });
    imageUrl = blob.url;
  } catch {
    return { ok: false, message: "Image upload failed. Try again." };
  }

  await updateSpotlightVariantImage(variantId, imageUrl);
  revalidateSpotlightPaths();
  return { ok: true, imageUrl };
}

export async function adminSetSpotlightVariantImageUrlAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSetSpotlightVariantImageUrlSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const variant = await getSpotlightVariantById(parsed.data.id);
  if (!variant) {
    return { ok: false, message: "Variant not found." };
  }

  await updateSpotlightVariantImage(parsed.data.id, parsed.data.imageUrl.trim());
  revalidateSpotlightPaths();
  return { ok: true, message: "Variant preview image saved." };
}
