import { z } from "zod";

import { priceUsdStringToCents } from "@/lib/validations/container-offering";
import { SPOTLIGHT_CATEGORY_ICON_NAMES } from "@/lib/spotlight-categories";
import {
  clipSpotlightLabel,
  normalizeHttpsUrl,
  SPOTLIGHT_LABEL_MAX,
} from "@/lib/product-url/https";

const httpsProductUrl = z.preprocess(
  (v) => normalizeHttpsUrl(v) ?? v,
  z
    .string()
    .trim()
    .min(8)
    .max(2048)
    .refine((s) => /^https:\/\//i.test(s), {
      message: "Product URL must start with https://",
    }),
);

const optionalPriceUsd = z
  .string()
  .trim()
  .optional()
  .refine(
    (s) =>
      s == null ||
      s === "" ||
      (Number.isFinite(Number.parseFloat(s)) && Number.parseFloat(s) >= 0),
    { message: "Enter a valid price or leave blank." },
  );

const optionalVariantText = z.string().trim().max(120).optional();

const optionalHttpsImageUrl = z.preprocess(
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
);

export const spotlightCategorySlugInputSchema = z
  .string()
  .trim()
  .min(2, "Category slug is required.")
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Use lowercase letters, numbers, and hyphens.",
  });

export const adminCreateSpotlightProductSchema = z.object({
  categorySlug: spotlightCategorySlugInputSchema,
  productUrl: httpsProductUrl,
  label: z.preprocess(
    (v) => (typeof v === "string" ? clipSpotlightLabel(v) : v),
    z.string().trim().max(SPOTLIGHT_LABEL_MAX).optional(),
  ),
  /** USD dollars; omit or leave blank when unknown. */
  priceUsd: optionalPriceUsd,
  productSize: optionalVariantText,
  productColor: optionalVariantText,
  /** SerpApi / listing image; skips og fetch when provided. */
  imageUrl: optionalHttpsImageUrl,
});

export type AdminCreateSpotlightProductInput = z.infer<
  typeof adminCreateSpotlightProductSchema
>;

export const adminDeleteSpotlightProductSchema = z.object({
  id: z.string().uuid(),
});

export const adminRefreshSpotlightProductImageSchema = z.object({
  id: z.string().uuid(),
});

export const adminSetSpotlightProductImageUrlSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z
    .string()
    .trim()
    .min(8)
    .max(2048)
    .refine((s) => /^https:\/\//i.test(s), {
      message: "Image URL must start with https://",
    }),
});

export const adminSetSpotlightProductPublishedSchema = z.object({
  id: z.string().uuid(),
  published: z.boolean(),
});

export const adminSetSpotlightCategoryPublishedSchema = z.object({
  categorySlug: spotlightCategorySlugInputSchema,
  published: z.boolean(),
});

export const adminCreateSpotlightCategorySchema = z.object({
  title: z.string().trim().min(2, "Enter a category name.").max(80),
  description: z
    .string()
    .trim()
    .min(8, "Enter a short description.")
    .max(240),
  tag: z.string().trim().max(32).optional(),
  iconName: z.enum(SPOTLIGHT_CATEGORY_ICON_NAMES).optional(),
});

export type AdminCreateSpotlightCategoryInput = z.infer<
  typeof adminCreateSpotlightCategorySchema
>;

export const adminDeleteSpotlightCategorySchema = z.object({
  categorySlug: spotlightCategorySlugInputSchema,
});

export const adminUpdateSpotlightProductSchema = z.object({
  id: z.string().uuid(),
  label: z.preprocess(
    (v) => (typeof v === "string" ? clipSpotlightLabel(v) : v),
    z.string().trim().max(SPOTLIGHT_LABEL_MAX),
  ),
  /** USD dollars; empty string clears the stored price. */
  priceUsd: optionalPriceUsd.transform((s) => s ?? ""),
  productSize: z.string().trim().max(120),
  productColor: z.string().trim().max(120),
});

export type AdminUpdateSpotlightProductInput = z.infer<
  typeof adminUpdateSpotlightProductSchema
>;

export const adminMoveSpotlightProductSchema = z.object({
  id: z.string().uuid(),
  categorySlug: spotlightCategorySlugInputSchema,
});

export type AdminMoveSpotlightProductInput = z.infer<
  typeof adminMoveSpotlightProductSchema
>;

/** Blank or invalid → null; positive USD → cents. */
export function parseOptionalPriceUsdToCents(
  priceUsd: string | undefined,
): number | null {
  const t = priceUsd?.trim();
  if (!t) return null;
  const cents = priceUsdStringToCents(t);
  return cents > 0 ? cents : null;
}

/** Trim; empty string → null for optional DB text fields. */
export function normalizeOptionalVariantField(
  value: string | undefined,
): string | null {
  const t = value?.trim();
  return t ? t : null;
}
