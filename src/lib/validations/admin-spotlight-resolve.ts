import { z } from "zod";

const httpsProductUrl = z
  .string()
  .trim()
  .min(8)
  .max(2048)
  .refine((s) => /^https:\/\//i.test(s), {
    message: "Product URL must start with https://",
  });

export const adminResolveSpotlightProductSchema = z.object({
  productUrl: httpsProductUrl,
});

const optionalHttps = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .refine((s) => !s || /^https:\/\//i.test(s), {
    message: "URL must start with https:// when provided.",
  });

export const adminSaveSpotlightVariantRowSchema = z.object({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().max(200).optional(),
  priceUsd: z.string().trim().optional(),
  productSize: z.string().trim().max(120).optional(),
  productColor: z.string().trim().max(120).optional(),
  packLabel: z.string().trim().max(120).optional(),
  productUrl: optionalHttps,
  imageUrl: optionalHttps,
});

export const adminSaveSpotlightVariantRowsSchema = z.object({
  parentProductId: z.string().uuid(),
  variants: z.array(adminSaveSpotlightVariantRowSchema).min(1).max(80),
});
