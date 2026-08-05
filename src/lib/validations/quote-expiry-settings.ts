import { z } from "zod";

import {
  MAX_QUOTE_EXPIRY_MINUTES,
  MIN_QUOTE_EXPIRY_MINUTES,
} from "@/lib/quote-expiry";

export const quoteExpiryDurationUnitSchema = z.enum([
  "minutes",
  "hours",
  "days",
]);

function refineDurationMinutes(
  val: { amount: number; unit: "minutes" | "hours" | "days" },
  ctx: z.RefinementCtx,
) {
  let minutes = val.amount;
  if (val.unit === "hours") minutes = val.amount * 60;
  if (val.unit === "days") minutes = val.amount * 24 * 60;
  if (minutes < MIN_QUOTE_EXPIRY_MINUTES || minutes > MAX_QUOTE_EXPIRY_MINUTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Enter a duration from 1 minute to 90 days (${MAX_QUOTE_EXPIRY_MINUTES.toLocaleString()} minutes).`,
      path: ["amount"],
    });
  }
}

export const updateQuoteExpirySettingsSchema = z
  .object({
    amount: z.coerce.number().int().positive(),
    unit: quoteExpiryDurationUnitSchema,
  })
  .superRefine(refineDurationMinutes);

export const upsertCustomerQuoteExpirySettingsSchema = z
  .object({
    clerkUserId: z.string().min(1),
    amount: z.coerce.number().int().positive(),
    unit: quoteExpiryDurationUnitSchema,
  })
  .superRefine(refineDurationMinutes);

export const deleteCustomerQuoteExpirySettingsSchema = z.object({
  clerkUserId: z.string().min(1),
});

export const upsertProductQuoteExpirySettingsSchema = z
  .object({
    itemRequestId: z.string().uuid(),
    amount: z.coerce.number().int().positive(),
    unit: quoteExpiryDurationUnitSchema,
    /** When true, detach from batch queues and restore the line to Active. */
    restoreToActive: z.boolean().optional().default(false),
  })
  .superRefine(refineDurationMinutes);

export const clearProductQuoteExpirySettingsSchema = z.object({
  itemRequestId: z.string().uuid(),
});

export const searchQuotedProductsForExpirySchema = z.object({
  query: z.string().max(200).optional().default(""),
  clerkUserId: z.string().min(1).optional().nullable(),
});
