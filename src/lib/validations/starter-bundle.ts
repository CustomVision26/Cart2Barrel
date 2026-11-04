import { z } from "zod";

import { STARTER_BUNDLE_MAX_ITEMS } from "@/lib/starter-bundles";

const optionalTrimmed = (max: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string") return v;
    const t = v.trim();
    return t === "" ? undefined : t;
  }, z.string().max(max).optional());

const optionalHttpsUrl = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (t === "") return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}, z.string().url().max(2048).optional());

export const starterBundleItemInputSchema = z.object({
  clientKey: z.string().min(1).max(80),
  productName: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(10_000),
  estimatedUnitPriceCents: z.number().int().min(0).max(50_000_000),
  productSize: optionalTrimmed(200),
  productColor: optionalTrimmed(200),
  retailerUrl: optionalHttpsUrl,
});

export const adminSaveStarterBundleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  imageUrl: optionalHttpsUrl,
  barrelSize: optionalTrimmed(120),
  barrelFillLevel: optionalTrimmed(120),
  items: z.array(starterBundleItemInputSchema).max(STARTER_BUNDLE_MAX_ITEMS),
});

export const adminStarterBundleIdSchema = z.object({
  id: z.string().uuid(),
});

export const adminSetStarterBundleMarqueePublishedSchema = z.object({
  published: z.boolean(),
});

export const submitStarterBundleQuoteSchema = z.object({
  bundleId: z.string().uuid(),
  bundleUpdatedAt: z.string().min(1).max(64),
  customerNote: optionalTrimmed(2000),
});

export type StarterBundleItemInput = z.infer<typeof starterBundleItemInputSchema>;
export type AdminSaveStarterBundleInput = z.infer<typeof adminSaveStarterBundleSchema>;
export type AdminSetStarterBundleMarqueePublishedInput = z.infer<
  typeof adminSetStarterBundleMarqueePublishedSchema
>;
export type SubmitStarterBundleQuoteInput = z.infer<
  typeof submitStarterBundleQuoteSchema
>;
