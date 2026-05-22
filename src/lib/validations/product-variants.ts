import { z } from "zod";

export const fetchProductVariantsSchema = z.object({
  productUrl: z
    .string()
    .trim()
    .url("Product URL must be valid.")
    .max(2000)
    .refine((u) => /^https:\/\//i.test(u), "Product URL must use https."),
  productName: z.string().trim().max(300).optional(),
  productSize: z.string().trim().max(200).optional(),
  productColor: z.string().trim().max(200).optional(),
});

export type FetchProductVariantsInput = z.infer<typeof fetchProductVariantsSchema>;
