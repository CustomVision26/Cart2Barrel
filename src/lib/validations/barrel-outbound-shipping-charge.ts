import { z } from "zod";

const chargeLineSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Each cost line needs a label.")
    .max(120, "Label is too long."),
  amountUsd: z
    .string()
    .trim()
    .min(1, "Enter an amount for each line.")
    .refine((v) => {
      const n = Number.parseFloat(v.replace(/^\$/, "").replace(/,/g, ""));
      return Number.isFinite(n) && n > 0;
    }, "Amount must be greater than zero."),
});

export const saveBarrelOutboundShippingChargeSchema = z.object({
  barrelId: z.string().uuid("Invalid container."),
  adminNote: z.string().trim().max(2000).optional().default(""),
  lines: z
    .array(chargeLineSchema)
    .min(1, "Add at least one cost line.")
    .max(20, "Too many cost lines."),
});

export type SaveBarrelOutboundShippingChargeInput = z.infer<
  typeof saveBarrelOutboundShippingChargeSchema
>;

export const addOutboundShippingChargeToCartSchema = z.object({
  chargeId: z.string().uuid("Invalid charge."),
});

export const removeOutboundShippingChargeFromCartSchema = z.object({
  chargeId: z.string().uuid("Invalid charge."),
});

export function parseUsdInputToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}
