import { z } from "zod";

const relatedOrderItemIdsSchema = z
  .array(z.string().uuid())
  .max(50)
  .optional();

const centsField = z.number().int().min(0).max(100_000_000);

export const recordMerchandiseReconciliationSchema = z.object({
  orderItemId: z.string().uuid(),
  checkoutMerchandiseCents: centsField,
  checkoutShippingCents: centsField,
  checkoutTaxCents: centsField,
  checkoutServiceCents: centsField,
  actualMerchandiseCents: centsField,
  actualShippingCents: centsField,
  actualTaxCents: centsField,
  actualServiceCents: centsField,
  /** Other paid-pending lines in the same batch; same totals/status are synced. */
  relatedOrderItemIds: relatedOrderItemIdsSchema,
});

export type RecordMerchandiseReconciliationInput = z.infer<
  typeof recordMerchandiseReconciliationSchema
>;

export const notifyMerchandisePriceChangeSchema = z.object({
  orderItemId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  imageUrls: z.array(z.string().url()).max(4).optional().default([]),
  relatedOrderItemIds: relatedOrderItemIdsSchema,
});

export type NotifyMerchandisePriceChangeInput = z.infer<
  typeof notifyMerchandisePriceChangeSchema
>;

export const requestMerchandiseTopupSchema = z.object({
  orderItemId: z.string().uuid(),
  /** Hours until top-up expires; default applied server-side when omitted. */
  expiryHours: z.number().int().min(1).max(24 * 14).optional(),
  /**
   * Optional checkout-vs-actual charge breakdown (Message customer body).
   * When set and `postCustomerMessage` is true, the top-up thread post uses this
   * plus add-on payment instructions.
   */
  customerMessage: z.string().trim().min(1).max(4000).optional(),
  /**
   * When false, create the top-up charge only — do not post a staff message
   * (admin fills Agree to pay draft and sends manually).
   */
  postCustomerMessage: z.boolean().optional().default(true),
  relatedOrderItemIds: relatedOrderItemIdsSchema,
});

export type RequestMerchandiseTopupInput = z.infer<
  typeof requestMerchandiseTopupSchema
>;

export const markMerchandiseTopupPaidSchema = z.object({
  orderItemId: z.string().uuid(),
  relatedOrderItemIds: relatedOrderItemIdsSchema,
});

export type MarkMerchandiseTopupPaidInput = z.infer<
  typeof markMerchandiseTopupPaidSchema
>;

export const revokeMerchandiseTopupSchema = z.object({
  orderItemId: z.string().uuid(),
  relatedOrderItemIds: relatedOrderItemIdsSchema,
});

export type RevokeMerchandiseTopupInput = z.infer<
  typeof revokeMerchandiseTopupSchema
>;

export const cancelMerchandiseReconciliationSchema = z.object({
  orderItemId: z.string().uuid(),
  /** Whole USD cents to refund; capped to remaining refundable across related lines. */
  refundAmountCents: z.number().int().min(1).max(100_000_000),
  reason: z.string().trim().max(500).optional(),
  relatedOrderItemIds: relatedOrderItemIdsSchema,
});

export type CancelMerchandiseReconciliationInput = z.infer<
  typeof cancelMerchandiseReconciliationSchema
>;

export const getMerchandiseReconciliationSchema = z.object({
  orderItemId: z.string().uuid(),
  /** Sibling batch lines — keeps dialogue resolution scoped to this batch. */
  relatedOrderItemIds: z.array(z.string().uuid()).optional(),
});

export const recordMerchandisePriceDecisionSchema = z.object({
  ticketId: z.string().uuid(),
  decision: z.enum(["topup", "cancel"]),
  /** Optional note sent with the decision as customer feedback. */
  note: z.string().trim().max(4000).optional().default(""),
  imageUrls: z.array(z.string().url()).max(4).optional().default([]),
});

export type RecordMerchandisePriceDecisionInput = z.infer<
  typeof recordMerchandisePriceDecisionSchema
>;
