import { z } from "zod";

const optionalTrackingUrl = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string") return v;
    const t = v.trim();
    return t === "" ? undefined : t;
  },
  z.string().url().max(2048).optional(),
);

export const shipHubStockUsPackageSchema = z.object({
  orderId: z.string().uuid(),
  trackingUrl: optionalTrackingUrl,
  retailerTrackingCompany: z
    .string()
    .trim()
    .min(1, "Enter the carrier name.")
    .max(120),
  retailerTrackingNumber: z
    .string()
    .trim()
    .min(1, "Enter the tracking number.")
    .max(200),
});

export type ShipHubStockUsPackageInput = z.infer<
  typeof shipHubStockUsPackageSchema
>;

export const hubStockUsPackageOrderIdSchema = z.object({
  orderId: z.string().uuid(),
});

export type HubStockUsPackageOrderIdInput = z.infer<
  typeof hubStockUsPackageOrderIdSchema
>;

export const generateHubStockUsLabelSchema = z.object({
  orderId: z.string().uuid(),
  carrier: z.string().trim().min(1).max(120).optional(),
  service: z.string().trim().min(1).max(200).optional(),
  cents: z.number().int().nonnegative().optional(),
});

export type GenerateHubStockUsLabelInput = z.infer<
  typeof generateHubStockUsLabelSchema
>;
