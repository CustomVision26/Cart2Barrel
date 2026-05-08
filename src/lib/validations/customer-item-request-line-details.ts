import { z } from "zod";

export const customerItemRequestLineDetailsSchema = z.object({
  itemRequestId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99_999),
  productSize: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim() ?? "";
      return t === "" ? null : t;
    }),
  productColor: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim() ?? "";
      return t === "" ? null : t;
    }),
});

export type CustomerItemRequestLineDetailsInput = z.infer<
  typeof customerItemRequestLineDetailsSchema
>;

export function parseCustomerItemRequestLineDetails(
  raw: unknown
):
  | { success: true; data: CustomerItemRequestLineDetailsInput }
  | { success: false; error: z.ZodError } {
  const parsed = customerItemRequestLineDetailsSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}
