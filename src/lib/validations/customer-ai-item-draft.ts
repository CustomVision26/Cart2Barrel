import { z } from "zod";

export const customerAiItemDraftSchema = z.object({
  productUrl: z
    .string()
    .trim()
    .min(1, "Product link is required.")
    .url("Enter a valid URL (https://…).")
    .max(2000),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity must be at least 1.")
    .max(999),
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
});

export type CustomerAiItemDraftInput = z.infer<typeof customerAiItemDraftSchema>;

export function parseCustomerAiItemDraftInput(
  raw: unknown
):
  | { success: true; data: CustomerAiItemDraftInput }
  | { success: false; error: z.ZodError } {
  const parsed = customerAiItemDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  return { success: true, data: parsed.data };
}
