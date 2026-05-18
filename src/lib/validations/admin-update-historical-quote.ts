import { z } from "zod";

/** Update an existing quote row + optional item request display fields (does not change request status). */
export const adminUpdateHistoricalQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  itemRequestId: z.string().uuid(),
  itemCost: z.number().int().min(0).max(50_000_000),
  merchandiseSavingsCents: z
    .number()
    .int()
    .min(0)
    .max(50_000_000)
    .optional(),
  serviceFee: z.number().int().min(0).max(10_000_000),
  estimatedShipping: z.number().int().min(0).max(5_000_000),
  tax: z.number().int().min(0).max(5_000_000),
  merchandiseIncludesSiteShippingTax: z.boolean().optional().default(false),
  quantity: z.number().int().min(1).max(99_999),
  productName: z
    .string()
    .max(500)
    .optional()
    .transform((s) => s?.trim() || undefined),
  productColor: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  productSize: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  productImageUrl: z
    .union([z.string().max(2048), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const t = v.trim();
      try {
        const u = new URL(t);
        return u.protocol === "https:" ? u.href : null;
      } catch {
        return null;
      }
    }),
  staffNote: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t ? t : undefined;
    }),
});

export type AdminUpdateHistoricalQuoteInput = z.infer<
  typeof adminUpdateHistoricalQuoteSchema
>;

export function parseAdminUpdateHistoricalQuoteInput(
  raw: unknown
):
  | { success: true; data: AdminUpdateHistoricalQuoteInput }
  | { success: false; error: z.ZodError } {
  const parsed = adminUpdateHistoricalQuoteSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}
