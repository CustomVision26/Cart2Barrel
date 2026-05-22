"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import type { AdminSpotlightProductMutationState } from "@/actions/admin-spotlight-products";
import {
  deleteSpotlightVariantsByParentId,
  getSpotlightVariantById,
  insertSpotlightVariants,
  nextSpotlightVariantSortIndex,
} from "@/data/spotlight-product-variants";
import { getSpotlightProductById } from "@/data/spotlight-category-products";
import { getDb } from "@/db";
import { spotlightProductVariants } from "@/db/schema";
import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  adminCreateSpotlightVariantSchema,
  adminDeleteSpotlightVariantSchema,
  adminImportSpotlightVariantsSchema,
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
    ...fields,
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
