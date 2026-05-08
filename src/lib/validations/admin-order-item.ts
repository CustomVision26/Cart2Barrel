import { z } from "zod";

export const confirmCompanyPurchaseSchema = z.object({
  orderItemId: z.string().uuid(),
});

export type ConfirmCompanyPurchaseInput = z.infer<
  typeof confirmCompanyPurchaseSchema
>;

export const requestDeliverySchema = z.object({
  orderItemId: z.string().uuid(),
});

export type RequestDeliveryInput = z.infer<typeof requestDeliverySchema>;

export const refundOrderLineSchema = z.object({
  orderItemId: z.string().uuid(),
  /** Partial or full line refund in USD cents (prorate up to remaining line and PI balance). */
  amountCents: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export type RefundOrderLineInput = z.infer<typeof refundOrderLineSchema>;
