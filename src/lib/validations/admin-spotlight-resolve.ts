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
