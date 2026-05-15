import { z } from "zod";

export const createItemRequestSchema = z.object({
  productUrl: z
    .string()
    .trim()
    .min(1, "Product link is required.")
    .url("Enter a valid URL (https://…).")
    .max(2000),
  productName: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  productSize: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  productColor: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(999),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  siteName: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  productImageUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .superRefine((val, ctx) => {
      if (!val) return;
      try {
        const u = new URL(val);
        if (u.protocol !== "https:") {
          ctx.addIssue({
            code: "custom",
            message: "Image URL must use https.",
          });
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid image URL.",
        });
      }
    }),
});

export type CreateItemRequestInput = z.infer<typeof createItemRequestSchema>;

export function parseCreateItemRequestInput(
  raw: unknown
):
  | { success: true; data: CreateItemRequestInput }
  | { success: false; error: z.ZodError } {
  const parsed = createItemRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  return { success: true, data: parsed.data };
}
