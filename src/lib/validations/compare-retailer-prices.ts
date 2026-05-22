import { z } from "zod";

export const compareRetailerPricesSchema = z.object({
  productName: z.string().trim().min(2).max(300),
  productSize: z.string().trim().max(200).optional(),
  productColor: z.string().trim().max(200).optional(),
  /** Original listing the shopper is comparing from. */
  originalProductUrl: z
    .string()
    .trim()
    .url("Original product URL must be valid.")
    .max(2000)
    .optional(),
  originalRetailer: z.string().trim().max(120).optional(),
  originalPriceUsdCents: z.number().int().positive().optional(),
  originalImageUrl: z.string().url().max(2000).optional(),
});

export type CompareRetailerPricesInput = z.infer<typeof compareRetailerPricesSchema>;
