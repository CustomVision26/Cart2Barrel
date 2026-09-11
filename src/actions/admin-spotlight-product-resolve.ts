"use server";

import { currentUser } from "@clerk/nextjs/server";

import type { AdminSpotlightProductMutationState } from "@/actions/admin-spotlight-products";
import { adminCreateSpotlightProductAction } from "@/actions/admin-spotlight-products";
import { adminCreateSpotlightVariantAction } from "@/actions/admin-spotlight-variants";
import {
  resolveAdminSpotlightFromSerpApi,
  type AdminSpotlightSerpApiResolveResult,
} from "@/lib/spotlight/admin-spotlight-serpapi-resolve";
import type { RetailerPriceOffer } from "@/lib/retailer-price-compare";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { withSerpApiUsage } from "@/lib/serpapi/usage-context";
import {
  adminResolveSpotlightProductSchema,
  adminSaveSpotlightVariantRowsSchema,
} from "@/lib/validations/admin-spotlight-resolve";
import {
  insertSpotlightVariants,
  nextSpotlightVariantSortIndex,
} from "@/data/spotlight-product-variants";
import { getSpotlightProductById } from "@/data/spotlight-category-products";
import { revalidatePath } from "next/cache";
import {
  adminCreateSpotlightProductSchema,
  type AdminCreateSpotlightProductInput,
} from "@/lib/validations/spotlight-category-product";
import { spotlightVariantFieldsFromInput } from "@/lib/validations/spotlight-product-variant";
import { z } from "zod";
import {
  clipSpotlightLabel,
  normalizeHttpsUrl,
  SPOTLIGHT_LABEL_MAX,
} from "@/lib/product-url/https";

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
        productTitle: string | null;
      }>;
      variantMethod: string;
      variantRetailer: string;
      compareOffers: RetailerPriceOffer[];
      compareSearchQuery: string;
      compareMessage: string | null;
    }
  | { ok: false; message: string };

const LOOKUP_BUDGET_MS = 20_000;

function lookupTimeoutResult(): Promise<AdminSpotlightSerpApiResolveResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: false,
        message:
          "Lookup took too long and was stopped so this page would not crash. Try again, or fill name and price from the product page.",
      });
    }, LOOKUP_BUDGET_MS);
  });
}

function centsToUsdField(cents: number | null): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

export async function adminResolveSpotlightProductAction(
  input: unknown,
): Promise<AdminResolveSpotlightProductResult> {
  try {
    const user = await currentUser();
    if (!user || !isClerkAdmin(user)) {
      return { ok: false, message: "Admin access required." };
    }
    const adminUserId = user.id;

    const parsed = adminResolveSpotlightProductSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }

    const result = await Promise.race([
      withSerpApiUsage(
        { userId: adminUserId, source: "admin_spotlight" },
        () => resolveAdminSpotlightFromSerpApi(parsed.data.productUrl),
      ),
      lookupTimeoutResult(),
    ]);
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
        productTitle: v.productTitle ?? null,
      })),
      variantMethod: result.variantMethod,
      variantRetailer: result.variantRetailer,
      compareOffers: result.compareOffers,
      compareSearchQuery: result.compareSearchQuery,
      compareMessage: result.compareMessage,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : "Product lookup failed. Try again.";
    return { ok: false, message };
  }
}

const adminSaveSpotlightOfferSchema = z.object({
  categorySlug: adminCreateSpotlightProductSchema.shape.categorySlug,
  productUrl: z.preprocess(
    (v) => normalizeHttpsUrl(v) ?? v,
    z
      .string()
      .trim()
      .min(8)
      .max(2048)
      .refine((s) => /^https:\/\//i.test(s), {
        message: "Product URL must start with https://",
      }),
  ),
  label: z.preprocess(
    (v) => (typeof v === "string" ? clipSpotlightLabel(v) : v),
    z.string().trim().max(SPOTLIGHT_LABEL_MAX).optional(),
  ),
  priceUsd: z.string().trim().optional(),
  productSize: z.string().trim().max(120).optional(),
  productColor: z.string().trim().max(120).optional(),
  packLabel: z.string().trim().max(120).optional(),
  imageUrl: z.preprocess(
    (v) => {
      if (v == null || v === "") return undefined;
      return normalizeHttpsUrl(v) ?? v;
    },
    z
      .string()
      .trim()
      .max(2048)
      .optional()
      .refine((s) => !s || /^https:\/\//i.test(s), {
        message: "Image URL must be https.",
      }),
  ),
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
  label: z.preprocess(
    (v) => (typeof v === "string" ? clipSpotlightLabel(v) : v),
    z.string().trim().max(SPOTLIGHT_LABEL_MAX).optional(),
  ),
  priceUsd: z.string().trim().optional(),
  productSize: z.string().trim().max(120).optional(),
  productColor: z.string().trim().max(120).optional(),
  packLabel: z.string().trim().max(120).optional(),
  productUrl: z.preprocess(
    (v) => {
      if (v == null || v === "") return undefined;
      return normalizeHttpsUrl(v) ?? v;
    },
    z
      .string()
      .trim()
      .max(2048)
      .optional()
      .refine((s) => !s || /^https:\/\//i.test(s), {
        message: "Variant URL must start with https:// when provided.",
      }),
  ),
  imageUrl: z.preprocess(
    (v) => {
      if (v == null || v === "") return undefined;
      return normalizeHttpsUrl(v) ?? v;
    },
    z
      .string()
      .trim()
      .max(2048)
      .optional()
      .refine((s) => !s || /^https:\/\//i.test(s), {
        message: "Image URL must start with https://",
      }),
  ),
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

/** Save several SerpApi variant rows under an existing spotlight parent. */
export async function adminSaveSpotlightVariantOffersAction(
  input: unknown,
): Promise<AdminSpotlightProductMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSaveSpotlightVariantRowsSchema.safeParse(input);
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

  let sortBase = await nextSpotlightVariantSortIndex(parent.id);
  const rows = parsed.data.variants.map((v) => {
    const fields = spotlightVariantFieldsFromInput(v);
    return {
      ...fields,
      sortIndex: sortBase++,
    };
  });

  const inserted = await insertSpotlightVariants(parent.id, rows);
  revalidatePath("/");
  revalidatePath("/admin/spotlight-products");
  return {
    ok: true,
    message: `Saved ${inserted} variant${inserted === 1 ? "" : "s"}.`,
  };
}
