import { z } from "zod";

export const adminAiEstimateRequestSchema = z.object({
  productUrl: z.string().trim().url().max(2000),
  quantity: z.coerce.number().int().min(1).max(999),
  productSize: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t === "" || t === undefined ? undefined : t;
    }),
  productColor: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t === "" || t === undefined ? undefined : t;
    }),
  /** When set (admin queue / quote edit), extraction image + optional title are saved on the request row immediately. */
  itemRequestId: z.string().uuid().optional(),
  /** Skip fetching product HTML (manual quote when retailer blocks bots). */
  skipPageFetch: z.boolean().optional(),
});

export type AdminAiEstimateRequest = z.infer<typeof adminAiEstimateRequestSchema>;

export function parseAdminAiEstimateRequest(
  raw: unknown
):
  | { success: true; data: AdminAiEstimateRequest }
  | { success: false; error: z.ZodError } {
  const parsed = adminAiEstimateRequestSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}
