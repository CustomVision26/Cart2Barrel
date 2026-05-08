import { z } from "zod";

export const saveAdminItemQuoteSchema = z.object({
  itemRequestId: z.string().uuid(),
  itemCost: z.number().int().min(0).max(50_000_000),
  serviceFee: z.number().int().min(0).max(10_000_000),
  estimatedShipping: z.number().int().min(0).max(5_000_000),
  tax: z.number().int().min(0).max(5_000_000),
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
});

export type SaveAdminItemQuoteInput = z.infer<typeof saveAdminItemQuoteSchema>;

export function parseSaveAdminItemQuoteInput(
  raw: unknown
):
  | { success: true; data: SaveAdminItemQuoteInput }
  | { success: false; error: z.ZodError } {
  const parsed = saveAdminItemQuoteSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}
