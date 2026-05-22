"use server";

import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";

import {
  getSpotlightProductById,
  nextSpotlightSortIndex,
  updateSpotlightProductDetails,
  updateSpotlightProductImage,
} from "@/data/spotlight-category-products";
import { getDb } from "@/db";
import { spotlightCategoryProducts } from "@/db/schema";
import { resolveSpotlightProductPreviewImage } from "@/lib/spotlight-product-preview";
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
import {
  adminCreateSpotlightProductSchema,
  adminDeleteSpotlightProductSchema,
  adminRefreshSpotlightProductImageSchema,
  adminUpdateSpotlightProductSchema,
  normalizeOptionalVariantField,
  parseOptionalPriceUsdToCents,
} from "@/lib/validations/spotlight-category-product";

export type AdminSpotlightProductMutationState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function revalidateSpotlightPaths(): void {
  revalidatePath("/");
  revalidatePath("/admin/spotlight-products");
}

export async function adminCreateSpotlightProductAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminCreateSpotlightProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { categorySlug, productUrl, label, priceUsd, productSize, productColor } =
    parsed.data;
  const priceUsdCents = parseOptionalPriceUsdToCents(priceUsd);
  let imageUrl: string | null = null;
  try {
    imageUrl = await resolveSpotlightProductPreviewImage(productUrl);
  } catch {
    imageUrl = null;
  }

  const sortIndex = await nextSpotlightSortIndex(categorySlug);
  const db = getDb();
  await db.insert(spotlightCategoryProducts).values({
    categorySlug,
    productUrl,
    imageUrl,
    priceUsdCents,
    productSize: normalizeOptionalVariantField(productSize),
    productColor: normalizeOptionalVariantField(productColor),
    label: label?.trim() || null,
    sortIndex,
    isActive: true,
  });

  revalidateSpotlightPaths();
  const previewNote =
    imageUrl ?
      "Product added with preview image."
    : "Product added. Preview image could not be fetched—you can retry refresh.";
  return { ok: true, message: previewNote };
}

export async function adminDeleteSpotlightProductAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminDeleteSpotlightProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const db = getDb();
  await db
    .delete(spotlightCategoryProducts)
    .where(eq(spotlightCategoryProducts.id, parsed.data.id));

  revalidateSpotlightPaths();
  return { ok: true, message: "Product removed." };
}

export async function adminRefreshSpotlightProductImageAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminRefreshSpotlightProductImageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const row = await getSpotlightProductById(parsed.data.id);
  if (!row) {
    return { ok: false, message: "Product not found." };
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await resolveSpotlightProductPreviewImage(row.productUrl);
  } catch {
    imageUrl = null;
  }

  await updateSpotlightProductImage(parsed.data.id, imageUrl);
  revalidateSpotlightPaths();

  if (!imageUrl) {
    return {
      ok: false,
      message:
        "Could not fetch a preview image from that URL. The retailer may block automated access.",
    };
  }
  return { ok: true, message: "Preview image updated." };
}

export async function adminUpdateSpotlightProductAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminUpdateSpotlightProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const row = await getSpotlightProductById(parsed.data.id);
  if (!row) {
    return { ok: false, message: "Product not found." };
  }

  const { priceUsd, productSize, productColor } = parsed.data;
  const priceUsdCents = parseOptionalPriceUsdToCents(priceUsd);

  await updateSpotlightProductDetails(parsed.data.id, {
    priceUsdCents,
    productSize: normalizeOptionalVariantField(productSize),
    productColor: normalizeOptionalVariantField(productColor),
  });
  revalidateSpotlightPaths();
  return { ok: true, message: "Product updated." };
}

export type AdminUploadSpotlightProductImageState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

/** Multipart upload for spotlight preview when auto-fetch failed. */
export async function adminUploadSpotlightProductImageAction(
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

  const productIdRaw = formData.get("productId");
  if (typeof productIdRaw !== "string" || !productIdRaw.trim()) {
    return { ok: false, message: "Missing product id." };
  }
  const productId = productIdRaw.trim();

  const fileRaw = formData.get("file");
  if (!(fileRaw instanceof File) || fileRaw.size === 0) {
    return { ok: false, message: "Choose an image file." };
  }

  const row = await getSpotlightProductById(productId);
  if (!row) {
    return { ok: false, message: "Product not found." };
  }
  if (row.imageUrl) {
    return {
      ok: false,
      message: "This product already has an image. Use Refresh image to replace it.",
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
  const pathname = `spotlight-products/${productId}/${randomUUID()}.${ext}`;
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

  await updateSpotlightProductImage(productId, imageUrl);
  revalidateSpotlightPaths();
  return { ok: true, imageUrl };
}
