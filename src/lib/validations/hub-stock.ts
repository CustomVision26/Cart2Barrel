import { z } from "zod";

import { priceUsdStringToCents } from "@/lib/validations/container-offering";
import { isUsState, US_STATES } from "@/lib/us-states";

export const hubStockDestinationSchema = z.enum([
  "us_address",
  "overseas_container",
]);

export type HubStockDestinationInput = z.infer<typeof hubStockDestinationSchema>;

export const adminHubStockProductSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(200),
  sizeLabel: z.string().trim().min(1, "Enter a size").max(120),
  colorLabel: z.string().trim().min(1, "Enter a color").max(120),
  description: z.string().trim().max(4000).optional().default(""),
  priceUsd: z
    .string()
    .trim()
    .min(1, "Enter a price")
    .refine(
      (s) => Number.isFinite(Number.parseFloat(s)) && Number.parseFloat(s) >= 0,
      { message: "Enter a valid price." },
    ),
  stockQty: z.coerce
    .number({ error: "Enter stock quantity" })
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative")
    .max(99_999, "Stock is too large"),
  parcelWeightOz: z.coerce
    .number({ error: "Enter package weight" })
    .positive("Weight must be greater than 0")
    .max(1_000, "Weight is too large"),
  parcelLengthIn: z.coerce
    .number({ error: "Enter package length" })
    .positive("Length must be greater than 0")
    .max(120, "Length is too large"),
  parcelWidthIn: z.coerce
    .number({ error: "Enter package width" })
    .positive("Width must be greater than 0")
    .max(120, "Width is too large"),
  parcelHeightIn: z.coerce
    .number({ error: "Enter package height" })
    .positive("Height must be greater than 0")
    .max(120, "Height is too large"),
  isActive: z.boolean().optional().default(false),
});

export type AdminHubStockProductInput = z.infer<typeof adminHubStockProductSchema>;

export const adminCreateHubStockProductSchema = adminHubStockProductSchema;

export const adminUpdateHubStockProductSchema = adminHubStockProductSchema.extend({
  id: z.string().uuid(),
});

export type AdminUpdateHubStockProductInput = z.infer<
  typeof adminUpdateHubStockProductSchema
>;

export const adminDeleteHubStockProductSchema = z.object({
  id: z.string().uuid(),
});

export const adminSetHubStockProductPublishedSchema = z.object({
  id: z.string().uuid(),
  published: z.boolean(),
});

export const adminUploadHubStockProductImagesSchema = z.object({
  productId: z.string().uuid(),
});

export const adminDeleteHubStockProductImageSchema = z.object({
  imageId: z.string().uuid(),
});

const usZipSchema = z
  .string()
  .trim()
  .regex(/^\d{5}(?:-\d{4})?$/, "Enter a 5-digit ZIP code");

export const hubStockUsAddressSchema = z.object({
  line1: z
    .string()
    .trim()
    .min(3, "Enter street address")
    .max(300, "Address line is too long"),
  line2: z.string().trim().max(300, "Address line is too long").optional(),
  city: z.string().trim().min(2, "Enter city").max(120, "City is too long"),
  state: z
    .string()
    .trim()
    .min(1, "Select a state")
    .refine((s) => isUsState(s), { message: "Select a valid US state" }),
  postalCode: usZipSchema,
});

export type HubStockUsAddressInput = z.infer<typeof hubStockUsAddressSchema>;

export const addHubStockToCartSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(99),
    destination: hubStockDestinationSchema,
    addressId: z.string().uuid().optional(),
    usAddress: hubStockUsAddressSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.destination === "us_address" &&
      !data.addressId &&
      !data.usAddress
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["addressId"],
        message: "Select a US shipping address.",
      });
    }
  });

export type AddHubStockToCartInput = z.infer<typeof addHubStockToCartSchema>;

export const updateHubStockCartAddressSchema = z.object({
  cartItemId: z.string().uuid(),
  addressId: z.string().uuid(),
});

export type UpdateHubStockCartAddressInput = z.infer<
  typeof updateHubStockCartAddressSchema
>;

export const listHubStockShippingRatesSchema = z.object({
  cartItemId: z.string().uuid(),
});

export const selectHubStockShippingRateSchema = z.object({
  cartItemId: z.string().uuid(),
  cents: z.number().int().min(0).max(1_000_000),
  carrier: z.string().trim().min(1).max(80),
  service: z.string().trim().min(1).max(120),
});

export const removeHubStockCartItemSchema = z.object({
  cartItemId: z.string().uuid(),
});

export type RemoveHubStockCartItemInput = z.infer<
  typeof removeHubStockCartItemSchema
>;

export function hubStockPriceUsdToCents(usd: string): number {
  return priceUsdStringToCents(usd);
}

export const adminHubShipFromSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter the warehouse or company name").max(120),
  phone: z.string().trim().min(10, "Enter a phone number").max(40),
  line1: z.string().trim().min(3, "Enter street address").max(300),
  line2: z.string().trim().max(300).optional().default(""),
  city: z.string().trim().min(2, "Enter city").max(120),
  state: z
    .string()
    .trim()
    .min(1, "Select a state")
    .refine((s) => isUsState(s), { message: "Select a valid US state" }),
  postalCode: usZipSchema,
  isPrimary: z.boolean().optional().default(false),
});

export type AdminHubShipFromInput = z.infer<typeof adminHubShipFromSchema>;

export const adminHubShipFromIdSchema = z.object({
  id: z.string().uuid(),
});

export { US_STATES };
