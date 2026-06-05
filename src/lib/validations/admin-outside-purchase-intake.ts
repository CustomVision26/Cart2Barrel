import { z } from "zod";

import {
  warehouseMissingReasonSchema,
  warehouseReceiveConditionSchema,
} from "@/lib/validations/admin-warehouse-receipt";

const outsidePurchaseReferenceSchema = z
  .string()
  .trim()
  .min(6)
  .max(40)
  .regex(/^OP-\d{8}-[A-Z0-9]{4}$/i, "Use format OP-YYYYMMDD-XXXX")
  .transform((s) => s.toUpperCase());

export const adminOutsidePurchaseIntakeSchema = z.object({
  clerkUserId: z.string().min(1).max(256),
  outsidePurchaseReference: outsidePurchaseReferenceSchema.optional(),
  productName: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(999),
  /**
   * Consumer units in each pack/case/bundle (1 = single item).
   * Service fee = per-unit fee × unitsPerPack × quantity (pack count).
   */
  unitsPerPack: z.number().int().min(1).max(9999).default(1),
  /** Listed unit price from the receipt — used only to pick the service & handling tier (not billed). */
  unitPriceCents: z.number().int().min(0).max(50_000_000),
  productSize: z
    .string()
    .max(200)
    .optional()
    .transform((s) => s?.trim() || undefined),
  productColor: z
    .string()
    .max(200)
    .optional()
    .transform((s) => s?.trim() || undefined),
  note: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => s?.trim() || undefined),
  staffNote: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t ? t : undefined;
    }),
  receivedCondition: warehouseReceiveConditionSchema.default("good"),
  /** Sub-reason captured only when `receivedCondition` is `missing`. */
  receivedMissingReason: warehouseMissingReasonSchema.optional(),
  receivedShelfLocation: z
    .string()
    .max(500)
    .optional()
    .transform((s) => s?.trim() ?? ""),
});

export type AdminOutsidePurchaseIntakeInput = z.infer<
  typeof adminOutsidePurchaseIntakeSchema
>;

export const adminUpdateOutsidePurchaseIntakeSchema =
  adminOutsidePurchaseIntakeSchema.extend({
    itemRequestId: z.string().uuid(),
  });

export type AdminUpdateOutsidePurchaseIntakeInput = z.infer<
  typeof adminUpdateOutsidePurchaseIntakeSchema
>;

export function parseAdminOutsidePurchaseIntakeInput(
  raw: unknown,
):
  | { success: true; data: AdminOutsidePurchaseIntakeInput }
  | { success: false; error: z.ZodError } {
  const parsed = adminOutsidePurchaseIntakeSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}
