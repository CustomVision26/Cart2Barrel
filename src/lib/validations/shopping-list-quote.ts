import { z } from "zod";

import { SHOPPING_LIST_MAX_LINES } from "@/lib/shopping-list-quote";

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
  return t === "" ? undefined : t;
}, z.string().url().max(2048).optional());

export const shoppingListLineDraftSchema = z.object({
  clientKey: z.string().min(1).max(80),
  productName: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(10_000),
  productSize: optionalTrimmed(200),
  productColor: optionalTrimmed(200),
  note: optionalTrimmed(2000),
  productImageUrl: optionalHttpsUrl,
});

export const submitShoppingListQuoteSchema = z.object({
  sourceImageUrl: z.string().url().max(2048),
  lines: z.array(shoppingListLineDraftSchema).min(1).max(SHOPPING_LIST_MAX_LINES),
});

export type ShoppingListLineDraftInput = z.infer<
  typeof shoppingListLineDraftSchema
>;
export type SubmitShoppingListQuoteInput = z.infer<
  typeof submitShoppingListQuoteSchema
>;

export const adminShoppingListLineQuoteSchema = z.object({
  itemRequestId: z.string().uuid(),
  productName: optionalTrimmed(300),
  quantity: z.number().int().min(1).max(10_000).optional(),
  productSize: optionalTrimmed(200),
  productColor: optionalTrimmed(200),
  note: optionalTrimmed(2000),
  productImageUrl: optionalHttpsUrl,
  itemCost: z.number().int().min(0).max(50_000_000),
  serviceFee: z.number().int().min(0).max(10_000_000),
  estimatedShipping: z.number().int().min(0).max(5_000_000),
  tax: z.number().int().min(0).max(5_000_000),
});

export const saveShoppingListEstimateSchema = z.object({
  shoppingListQuoteId: z.string().uuid(),
  lines: z
    .array(adminShoppingListLineQuoteSchema)
    .min(1)
    .max(SHOPPING_LIST_MAX_LINES),
  siteMerchandiseCents: z.number().int().min(0).max(50_000_000),
  siteShippingCents: z.number().int().min(0).max(5_000_000),
  siteSaleTaxCents: z.number().int().min(0).max(5_000_000),
  staffNote: optionalTrimmed(4000),
});

export type SaveShoppingListEstimateInput = z.infer<
  typeof saveShoppingListEstimateSchema
>;
