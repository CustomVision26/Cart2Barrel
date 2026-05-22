import { z } from "zod";

import { priceUsdStringToCents } from "@/lib/validations/container-offering";
import { spotlightCategorySlugSchema } from "@/lib/spotlight-categories";

const httpsProductUrl = z
  .string()
  .trim()
  .min(8)
  .max(2048)
  .refine((s) => /^https:\/\//i.test(s), {
    message: "Product URL must start with https://",
  });

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

const optionalHttpsImageUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .refine((s) => !s || /^https:\/\//i.test(s), {
    message: "Image URL must start with https://",
  });

export const adminCreateSpotlightProductSchema = z.object({
  categorySlug: z.enum(spotlightCategorySlugSchema),
  productUrl: httpsProductUrl,
  label: z.string().trim().max(200).optional(),
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

export const adminUpdateSpotlightProductSchema = z.object({
  id: z.string().uuid(),
  /** USD dollars; empty string clears the stored price. */
  priceUsd: optionalPriceUsd.transform((s) => s ?? ""),
  productSize: z.string().trim().max(120),
  productColor: z.string().trim().max(120),
});

export type AdminUpdateSpotlightProductInput = z.infer<
  typeof adminUpdateSpotlightProductSchema
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
