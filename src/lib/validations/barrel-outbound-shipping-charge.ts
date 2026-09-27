import { z } from "zod";

import { BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS } from "@/lib/barrel-outbound-shipping-charge";

export const barrelOutboundShippingChargeKindSchema = z.enum(
  BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS,
);

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
  chargeKind: barrelOutboundShippingChargeKindSchema,
  partnerName: z.string().trim().max(160).optional().default(""),
  partnerLocation: z.string().trim().max(160).optional().default(""),
  partnerAddress: z.string().trim().max(500).optional().default(""),
  partnerCountry: z.string().trim().max(80).optional().default(""),
  adminNote: z.string().trim().max(2000).optional().default(""),
  lines: z
    .array(chargeLineSchema)
    .min(1, "Add at least one cost line.")
    .max(20, "Too many cost lines."),
});

export type SaveBarrelOutboundShippingChargeInput = z.infer<
  typeof saveBarrelOutboundShippingChargeSchema
>;

export const setBarrelOutboundChargeBundleSchema = z.object({
  barrelId: z.string().uuid("Invalid container."),
  kinds: z.array(barrelOutboundShippingChargeKindSchema).max(3),
});

export type SetBarrelOutboundChargeBundleInput = z.infer<
  typeof setBarrelOutboundChargeBundleSchema
>;

export const addBarrelOutboundShippingPartnerSchema = z.object({
  barrelId: z.string().uuid("Invalid container."),
  chargeKind: barrelOutboundShippingChargeKindSchema,
  name: z.string().trim().min(1, "Enter a name.").max(160),
  location: z.string().trim().max(160).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  cashappId: z.string().trim().max(80).optional().default(""),
  cashappAccount: z.string().trim().max(160).optional().default(""),
  zelleId: z.string().trim().max(80).optional().default(""),
  zelleAccount: z.string().trim().max(160).optional().default(""),
  isPrimary: z.boolean().optional().default(false),
});

export const updateBarrelOutboundShippingPartnerSchema = z.object({
  id: z.string().uuid("Invalid record."),
  name: z.string().trim().min(1, "Enter a name.").max(160),
  location: z.string().trim().max(160).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  cashappId: z.string().trim().max(80).optional().default(""),
  cashappAccount: z.string().trim().max(160).optional().default(""),
  zelleId: z.string().trim().max(80).optional().default(""),
  zelleAccount: z.string().trim().max(160).optional().default(""),
  isPrimary: z.boolean().optional().default(false),
});

export const applyCatalogOutboundShippingPartnerSchema = z.object({
  sourcePartnerId: z.string().uuid("Invalid record."),
  barrelId: z.string().uuid("Invalid container."),
});

export const setBarrelOutboundShippingPartnerPrimarySchema = z.object({
  id: z.string().uuid("Invalid record."),
});

export const deleteBarrelOutboundShippingPartnerSchema = z.object({
  id: z.string().uuid("Invalid record."),
});

export const addOutboundShippingChargeToCartSchema = z.object({
  chargeId: z.string().uuid("Invalid charge."),
});

export const removeOutboundShippingChargeFromCartSchema = z.object({
  chargeId: z.string().uuid("Invalid charge."),
});

export const submitOutboundOffPlatformPaymentSchema = z.object({
  chargeId: z.string().uuid("Invalid charge."),
  paymentMethod: z.enum(["zelle", "cashapp", "local_office"]),
  payerAccountName: z.string().trim().max(160).optional().default(""),
});

export type SubmitOutboundOffPlatformPaymentInput = z.infer<
  typeof submitOutboundOffPlatformPaymentSchema
>;

export const approveOutboundOffPlatformPaymentSchema = z.object({
  chargeId: z.string().uuid("Invalid charge."),
});

export type ApproveOutboundOffPlatformPaymentInput = z.infer<
  typeof approveOutboundOffPlatformPaymentSchema
>;

export function parseUsdInputToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}
