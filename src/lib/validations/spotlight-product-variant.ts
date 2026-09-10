import { z } from "zod";

import {
  normalizeOptionalVariantField,
  parseOptionalPriceUsdToCents,
} from "@/lib/validations/spotlight-category-product";

const httpsProductUrlOptional = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .refine(
    (s) => !s || /^https:\/\//i.test(s),
    { message: "Variant URL must start with https:// when provided." },
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

export const adminImportSpotlightVariantsSchema = z.object({
  parentProductId: z.string().uuid(),
  replaceExisting: z.boolean().optional().default(false),
});

const optionalHttpsImageUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .refine((s) => !s || /^https:\/\//i.test(s), {
    message: "Image URL must start with https://",
  });

export const adminCreateSpotlightVariantSchema = z.object({
  parentProductId: z.string().uuid(),
  label: z.string().trim().max(200).optional(),
  priceUsd: optionalPriceUsd,
  productSize: optionalVariantText,
  productColor: optionalVariantText,
  packLabel: optionalVariantText,
  productUrl: httpsProductUrlOptional,
  imageUrl: optionalHttpsImageUrl,
});

export const adminUpdateSpotlightVariantSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().max(200),
  priceUsd: optionalPriceUsd.transform((s) => s ?? ""),
  productSize: z.string().trim().max(120),
  productColor: z.string().trim().max(120),
  packLabel: z.string().trim().max(120),
  productUrl: z.string().trim().max(2048),
  isActive: z.boolean(),
});

export const adminDeleteSpotlightVariantSchema = z.object({
  id: z.string().uuid(),
});

export const adminAddSpotlightVariantSizesSchema = z.object({
  parentProductId: z.string().uuid(),
  sourceVariantId: z.string().uuid().optional(),
  sizesText: z.string().trim().min(1).max(2000),
});

export const adminRefreshSpotlightVariantImageSchema = z.object({
  id: z.string().uuid(),
});

export const adminSetSpotlightVariantImageUrlSchema = z.object({
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

export function spotlightVariantFieldsFromInput(input: {
  label?: string;
  priceUsd?: string;
  productSize?: string;
  productColor?: string;
  packLabel?: string;
  productUrl?: string;
  imageUrl?: string;
}): {
  label: string | null;
  priceUsdCents: number | null;
  productSize: string | null;
  productColor: string | null;
  packLabel: string | null;
  productUrl: string | null;
  imageUrl: string | null;
} {
  return {
    label: normalizeOptionalVariantField(input.label),
    priceUsdCents: parseOptionalPriceUsdToCents(input.priceUsd),
    productSize: normalizeOptionalVariantField(input.productSize),
    productColor: normalizeOptionalVariantField(input.productColor),
    packLabel: normalizeOptionalVariantField(input.packLabel),
    productUrl: normalizeOptionalVariantField(input.productUrl),
    imageUrl: normalizeOptionalVariantField(input.imageUrl),
  };
}

/** Split pasted size lists like SHEIN: `US6-6.5 (CN36-37), US7-7.5 (CN38-39)`. */
export function parseSpotlightSizeList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const size = part.trim();
    if (!size || size.length > 120) continue;
    const key = size.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(size);
  }
  return out.slice(0, 24);
}
