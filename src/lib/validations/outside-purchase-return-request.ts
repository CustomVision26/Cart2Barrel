import { z } from "zod";

export const submitOutsidePurchaseReturnRequestSchema = z.object({
  itemRequestId: z.string().uuid(),
  returnWindowStart: z.string().datetime({ offset: true }),
  returnWindowEnd: z.string().datetime({ offset: true }),
  customerNotes: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => s?.trim() || undefined),
  acknowledgeDiscardPolicy: z.literal(true, {
    message: "Confirm you understand the discard policy for unpaid problem receipts.",
  }),
});

export type SubmitOutsidePurchaseReturnRequestInput = z.infer<
  typeof submitOutsidePurchaseReturnRequestSchema
>;

export const acceptOutsidePurchaseReturnEstimateSchema = z.object({
  itemRequestId: z.string().uuid(),
  acknowledgeReturnCharges: z.literal(true, {
    message: "Confirm you accept the return service and handling charges.",
  }),
});

export const adminOutsidePurchaseReturnEstimateSchema = z.object({
  itemRequestId: z.string().uuid(),
  returnServiceFeeCents: z.number().int().min(0).max(50_000_000),
  returnTransitFeeCents: z.number().int().min(0).max(50_000_000).optional(),
  returnStaffNote: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => s?.trim() || undefined),
});

export const cancelOutsidePurchaseReturnRequestSchema = z.object({
  itemRequestId: z.string().uuid(),
});

export type AdminOutsidePurchaseReturnEstimateInput = z.infer<
  typeof adminOutsidePurchaseReturnEstimateSchema
>;
