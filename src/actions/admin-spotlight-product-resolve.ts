"use server";

import { currentUser } from "@clerk/nextjs/server";

import type { AdminSpotlightProductMutationState } from "@/actions/admin-spotlight-products";
import { adminCreateSpotlightProductAction } from "@/actions/admin-spotlight-products";
import { adminCreateSpotlightVariantAction } from "@/actions/admin-spotlight-variants";
import { resolveAdminSpotlightFromSerpApi } from "@/lib/spotlight/admin-spotlight-serpapi-resolve";
import type { RetailerPriceOffer } from "@/lib/retailer-price-compare";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { adminResolveSpotlightProductSchema } from "@/lib/validations/admin-spotlight-resolve";
import {
  adminCreateSpotlightProductSchema,
  type AdminCreateSpotlightProductInput,
} from "@/lib/validations/spotlight-category-product";
import { z } from "zod";

export type AdminResolveSpotlightProductResult =
  | {
      ok: true;
      primary: {
        productUrl: string;
        productName: string;
        priceUsd: string;
        imageUrl: string | null;
        productSize: string;
        productColor: string;
      };
      variants: Array<{
        id: string;
        label: string;
        size: string | null;
        color: string | null;
        packLabel: string | null;
        priceUsdCents: number | null;
        productUrl: string | null;
        imageUrl: string | null;
        isCurrent: boolean;
      }>;
      variantMethod: string;
      variantRetailer: string;
      compareOffers: RetailerPriceOffer[];
      compareSearchQuery: string;
      compareMessage: string | null;
    }
  | { ok: false; message: string };

function centsToUsdField(cents: number | null): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

export async function adminResolveSpotlightProductAction(
  input: unknown,
): Promise<AdminResolveSpotlightProductResult> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminResolveSpotlightProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await resolveAdminSpotlightFromSerpApi(parsed.data.productUrl);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const { primary } = result;
  return {
    ok: true,
    primary: {
      productUrl: primary.productUrl,
      productName: primary.productName,
      priceUsd: centsToUsdField(primary.priceUsdCents),
      imageUrl: primary.imageUrl,
      productSize: primary.productSize ?? "",
      productColor: primary.productColor ?? "",
    },
    variants: result.variants.map((v) => ({
      id: v.id,
      label: v.label,
      size: v.size,
      color: v.color,
      packLabel: v.packLabel,
      priceUsdCents: v.priceUsdCents,
      productUrl: v.productUrl,
      imageUrl: v.imageUrl,
      isCurrent: v.isCurrent,
    })),
    variantMethod: result.variantMethod,
    variantRetailer: result.variantRetailer,
    compareOffers: result.compareOffers,
    compareSearchQuery: result.compareSearchQuery,
    compareMessage: result.compareMessage,
  };
}

const adminSaveSpotlightOfferSchema = z.object({
  categorySlug: adminCreateSpotlightProductSchema.shape.categorySlug,
  productUrl: z.string().trim().url().max(2048).refine((s) => /^https:\/\//i.test(s)),
  label: z.string().trim().max(200).optional(),
  priceUsd: z.string().trim().optional(),
  productSize: z.string().trim().max(120).optional(),
  productColor: z.string().trim().max(120).optional(),
  packLabel: z.string().trim().max(120).optional(),
  imageUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .refine((s) => !s || /^https:\/\//i.test(s), {
      message: "Image URL must be https.",
    }),
});

export type AdminSaveSpotlightOfferResult =
  | { ok: true; message: string; parentProductId: string }
  | { ok: false; message: string };

/** Save a primary listing or a retailer compare row as a spotlight product. */
export async function adminSaveSpotlightProductOfferAction(
  input: unknown,
): Promise<AdminSaveSpotlightOfferResult> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSaveSpotlightOfferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const payload: AdminCreateSpotlightProductInput & { imageUrl?: string } = {
    categorySlug: parsed.data.categorySlug,
    productUrl: parsed.data.productUrl,
    label: parsed.data.label,
    priceUsd: parsed.data.priceUsd,
    productSize: parsed.data.productSize,
    productColor: parsed.data.productColor,
    imageUrl: parsed.data.imageUrl,
  };

  const res = await adminCreateSpotlightProductAction(payload);
  if (!res.ok) {
    return { ok: false, message: res.message };
  }

  if (!res.productId) {
    return { ok: false, message: "Product saved but id was not returned." };
  }

  return {
    ok: true,
    message: res.message ?? "Saved to spotlight.",
    parentProductId: res.productId,
  };
}

const adminSaveVariantOfferSchema = z.object({
  parentProductId: z.string().uuid(),
  label: z.string().trim().max(200).optional(),
  priceUsd: z.string().trim().optional(),
  productSize: z.string().trim().max(120).optional(),
  productColor: z.string().trim().max(120).optional(),
  packLabel: z.string().trim().max(120).optional(),
  productUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .refine((s) => !s || /^https:\/\//i.test(s)),
  imageUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .refine((s) => !s || /^https:\/\//i.test(s)),
});

/** Save one SerpApi variant row under an existing spotlight parent. */
export async function adminSaveSpotlightVariantOfferAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSaveVariantOfferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  return adminCreateSpotlightVariantAction(parsed.data);
}
