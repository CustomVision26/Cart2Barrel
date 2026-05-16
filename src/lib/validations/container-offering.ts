import { z } from "zod";

export const adminCreateContainerOfferingSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sizeLabel: z.string().trim().min(1).max(200),
  /** USD dollars as decimal string or whole number, e.g. "12.99" or "13" */
  priceUsd: z
    .string()
    .trim()
    .min(1)
    .refine((s) => Number.isFinite(Number.parseFloat(s)) && Number.parseFloat(s) >= 0, {
      message: "Enter a valid price.",
    }),
});

export type AdminCreateContainerOfferingInput = z.infer<
  typeof adminCreateContainerOfferingSchema
>;

export const adminUpdateContainerOfferingSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  sizeLabel: z.string().trim().min(1).max(200),
  priceUsd: z
    .string()
    .trim()
    .min(1)
    .refine((s) => Number.isFinite(Number.parseFloat(s)) && Number.parseFloat(s) >= 0, {
      message: "Enter a valid price.",
    }),
  isActive: z.boolean(),
});

export type AdminUpdateContainerOfferingInput = z.infer<
  typeof adminUpdateContainerOfferingSchema
>;

export function priceUsdStringToCents(usd: string): number {
  const n = Number.parseFloat(usd.trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export const userContainerCartMutationSchema = z.object({
  offeringId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export type UserContainerCartMutationInput = z.infer<
  typeof userContainerCartMutationSchema
>;
