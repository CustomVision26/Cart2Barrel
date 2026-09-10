"use server";

import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";

import {
  getSpotlightProductById,
  moveSpotlightProductToCategory,
  nextSpotlightSortIndex,
  setSpotlightProductPublished,
  updateSpotlightProductDetails,
  updateSpotlightProductImage,
} from "@/data/spotlight-category-products";
import {
  createSpotlightCategory,
  deleteSpotlightCategory,
  listSpotlightCategoryRecords,
  setSpotlightCategoryPublished,
} from "@/data/spotlight-categories";
import { nextSpotlightCategoryIconName } from "@/lib/spotlight-categories";
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
  adminCreateSpotlightCategorySchema,
  adminCreateSpotlightProductSchema,
  adminDeleteSpotlightCategorySchema,
  adminDeleteSpotlightProductSchema,
  adminMoveSpotlightProductSchema,
  adminRefreshSpotlightProductImageSchema,
  adminSetSpotlightCategoryPublishedSchema,
  adminSetSpotlightProductImageUrlSchema,
  adminSetSpotlightProductPublishedSchema,
  adminUpdateSpotlightProductSchema,
  normalizeOptionalVariantField,
  parseOptionalPriceUsdToCents,
} from "@/lib/validations/spotlight-category-product";

export type AdminSpotlightProductMutationState =
  | { ok: true; message?: string; productId?: string; categorySlug?: string }
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

  const {
    categorySlug,
    productUrl,
    label,
    priceUsd,
    productSize,
    productColor,
    imageUrl: imageUrlInput,
  } = parsed.data;
  const priceUsdCents = parseOptionalPriceUsdToCents(priceUsd);
  let imageUrl: string | null = imageUrlInput?.trim() || null;
  if (!imageUrl) {
    try {
      imageUrl = await resolveSpotlightProductPreviewImage(productUrl);
    } catch {
      imageUrl = null;
    }
  }

  const sortIndex = await nextSpotlightSortIndex(categorySlug);
  const db = getDb();
  const [inserted] = await db
    .insert(spotlightCategoryProducts)
    .values({
      categorySlug,
      productUrl,
      imageUrl,
      priceUsdCents,
      productSize: normalizeOptionalVariantField(productSize),
      productColor: normalizeOptionalVariantField(productColor),
      label: label?.trim() || null,
      sortIndex,
      isActive: false,
    })
    .returning({ id: spotlightCategoryProducts.id });

  revalidateSpotlightPaths();
  const previewNote =
    imageUrl ?
      "Product added as unpublished with preview image. Publish the row when shoppers should see it."
    : "Product added as unpublished. Preview image could not be fetched—you can retry refresh. Publish the row when shoppers should see it.";
  return {
    ok: true,
    message: previewNote,
    productId: inserted?.id,
  };
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
        "Could not fetch a preview image. Amazon/Walmart pages often block HTML scraping; variant rows usually get images from SerpApi at import. Try Upload, Paste URL, or use a /dp/ASIN product link.",
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

  const { label, priceUsd, productSize, productColor } = parsed.data;
  const priceUsdCents = parseOptionalPriceUsdToCents(priceUsd);

  await updateSpotlightProductDetails(parsed.data.id, {
    label: normalizeOptionalVariantField(label),
    priceUsdCents,
    productSize: normalizeOptionalVariantField(productSize),
    productColor: normalizeOptionalVariantField(productColor),
  });
  revalidateSpotlightPaths();
  return { ok: true, message: "Product updated." };
}

export async function adminMoveSpotlightProductAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminMoveSpotlightProductSchema.safeParse(input);
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

  if (row.categorySlug === parsed.data.categorySlug) {
    return { ok: false, message: "Product is already in that category." };
  }

  const categories = await listSpotlightCategoryRecords();
  const destination = categories.find((c) => c.slug === parsed.data.categorySlug);
  if (!destination) {
    return { ok: false, message: "Category not found." };
  }

  await moveSpotlightProductToCategory(parsed.data.id, parsed.data.categorySlug);
  revalidateSpotlightPaths();
  return {
    ok: true,
    message: `Moved to ${destination.title}. Saved variants stay with this product.`,
    categorySlug: destination.slug,
  };
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
  const replace = formData.get("replace") === "true";
  if (row.imageUrl && !replace) {
    return {
      ok: false,
      message:
        "This product already has an image. Upload again with replace enabled, or use Refresh image.",
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

/** Set preview image from an https URL (manual paste). */
export async function adminSetSpotlightProductImageUrlAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSetSpotlightProductImageUrlSchema.safeParse(input);
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

  await updateSpotlightProductImage(parsed.data.id, parsed.data.imageUrl.trim());
  revalidateSpotlightPaths();
  return { ok: true, message: "Preview image saved." };
}

export async function adminSetSpotlightProductPublishedAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSetSpotlightProductPublishedSchema.safeParse(input);
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

  await setSpotlightProductPublished(parsed.data.id, parsed.data.published);
  revalidateSpotlightPaths();
  return {
    ok: true,
    message: parsed.data.published
      ? "Published. Shoppers can see this product when the category is published."
      : "Unpublished. Shoppers will no longer see this product.",
  };
}

export async function adminSetSpotlightCategoryPublishedAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSetSpotlightCategoryPublishedSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await setSpotlightCategoryPublished(
      parsed.data.categorySlug,
      parsed.data.published,
    );
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Could not update category publish state.",
    };
  }

  revalidateSpotlightPaths();
  return {
    ok: true,
    message: parsed.data.published
      ? "Category published. Shoppers see this category and its published products on Home."
      : "Category unpublished. Shoppers will not see this category on Home.",
  };
}

export async function adminCreateSpotlightCategoryAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminCreateSpotlightCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const category = await createSpotlightCategory({
      title: parsed.data.title,
      description: parsed.data.description,
      tag: parsed.data.tag?.trim() || "New",
      iconName:
        parsed.data.iconName ?? nextSpotlightCategoryIconName(Date.now()),
    });
    revalidateSpotlightPaths();
    return {
      ok: true,
      categorySlug: category.slug,
      message:
        "Category created. It starts unpublished—add products, then publish it for Home.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Could not create category.",
    };
  }
}

export async function adminDeleteSpotlightCategoryAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminDeleteSpotlightCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await deleteSpotlightCategory(parsed.data.categorySlug);
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Could not delete category.",
    };
  }

  revalidateSpotlightPaths();
  return {
    ok: true,
    message: "Category deleted, including its spotlight products.",
  };
}
