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
  listAdminVariantsByParentIds,
  nextSpotlightVariantSortIndex,
  updateSpotlightVariantImage,
} from "@/data/spotlight-product-variants";
import { getSpotlightProductById } from "@/data/spotlight-category-products";
import { getDb } from "@/db";
import { spotlightProductVariants } from "@/db/schema";
import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { buildVariantLabel } from "@/lib/product-variants/labels";
import { withSerpApiUsage } from "@/lib/serpapi/usage-context";
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
  adminAddSpotlightVariantSizesSchema,
  adminCreateSpotlightVariantSchema,
  adminDeleteSpotlightVariantSchema,
  adminImportSpotlightVariantsSchema,
  adminRefreshSpotlightVariantImageSchema,
  adminSetSpotlightVariantImageUrlSchema,
  adminUpdateSpotlightVariantSchema,
  parseSpotlightSizeList,
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
  if (!user || !isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const adminUserId = user.id;

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

  const result = await withSerpApiUsage(
    { userId: adminUserId, source: "admin_spotlight" },
    () =>
      fetchProductVariants({
        productUrl: parent.productUrl,
        productName: parent.label?.trim() || undefined,
        productSize: parent.productSize ?? undefined,
        productColor: parent.productColor ?? undefined,
      }),
  );

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  if (parsed.data.replaceExisting) {
    await deleteSpotlightVariantsByParentId(parent.id);
  }

  let sortBase = await nextSpotlightVariantSortIndex(parent.id);
  const rows = result.variants.map((v: ProductVariantOffer) => ({
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

function variantColorKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function variantSizeKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/** Extra sizes for one color, copying URL, cost, and image from the listing or a saved SKU. */
export async function adminAddSpotlightVariantSizesAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminAddSpotlightVariantSizesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const sizes = parseSpotlightSizeList(parsed.data.sizesText);
  if (sizes.length === 0) {
    return {
      ok: false,
      message: "Enter at least one size (comma or line separated).",
    };
  }

  const parent = await getSpotlightProductById(parsed.data.parentProductId);
  if (!parent) {
    return { ok: false, message: "Parent product not found." };
  }

  let sourceColor = parent.productColor;
  let sourceUrl: string | null = null;
  let sourceImage = parent.imageUrl;
  let sourcePrice = parent.priceUsdCents;
  let sourcePack: string | null = null;

  if (parsed.data.sourceVariantId) {
    const source = await getSpotlightVariantById(parsed.data.sourceVariantId);
    if (!source || source.parentProductId !== parent.id) {
      return { ok: false, message: "Variant not found." };
    }
    sourceColor = source.productColor ?? parent.productColor;
    sourceUrl = source.productUrl;
    sourceImage = source.imageUrl ?? parent.imageUrl;
    sourcePrice = source.priceUsdCents ?? parent.priceUsdCents;
    sourcePack = source.packLabel;
  }

  const existing = await listAdminVariantsByParentIds(
    [parent.id],
    new Map([[parent.id, parent.productUrl]]),
  );
  const existingRows = existing.get(parent.id) ?? [];
  const colorKey = variantColorKey(sourceColor);
  const taken = new Set<string>();
  if (variantColorKey(parent.productColor) === colorKey && parent.productSize) {
    taken.add(variantSizeKey(parent.productSize));
  }
  for (const row of existingRows) {
    if (variantColorKey(row.productColor) !== colorKey) continue;
    if (row.productSize) taken.add(variantSizeKey(row.productSize));
  }

  const newSizes = sizes.filter((size) => !taken.has(variantSizeKey(size)));
  if (newSizes.length === 0) {
    return {
      ok: false,
      message: "Those sizes already exist for this color.",
    };
  }

  let sortBase = await nextSpotlightVariantSortIndex(parent.id);
  const copiedUrl =
    sourceUrl && sourceUrl !== parent.productUrl ? sourceUrl : null;
  const rows = newSizes.map((productSize) => ({
    productUrl: copiedUrl,
    imageUrl: sourceImage,
    priceUsdCents: sourcePrice,
    productSize,
    productColor: sourceColor,
    packLabel: sourcePack,
    label: buildVariantLabel({
      color: sourceColor,
      size: productSize,
      packLabel: sourcePack,
    }),
    sortIndex: sortBase++,
  }));

  const inserted = await insertSpotlightVariants(parent.id, rows);
  revalidateSpotlightPaths();
  const skipped = sizes.length - newSizes.length;
  return {
    ok: true,
    message:
      skipped > 0
        ? `Added ${inserted} size${inserted === 1 ? "" : "s"} for this color (${skipped} already existed).`
        : `Added ${inserted} size${inserted === 1 ? "" : "s"} for this color.`,
  };
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
