import { z } from "zod";

export const createCustomerBatchQuoteSchema = z.object({
  itemRequestIds: z.array(z.string().uuid()).min(2),
});

export type CreateCustomerBatchQuoteInput = z.infer<
  typeof createCustomerBatchQuoteSchema
>;

export const submitCustomerBatchQuoteSchema = z.object({
  batchSessionId: z.string().uuid(),
});

export type SubmitCustomerBatchQuoteInput = z.infer<
  typeof submitCustomerBatchQuoteSchema
>;

/** Detach quoted lines back to Products — draft batches only. */
export const removeDraftBatchProductsSchema = z.object({
  batchSessionId: z.string().uuid(),
  itemRequestIds: z.array(z.string().uuid()).min(1),
});

export type RemoveDraftBatchProductsInput = z.infer<
  typeof removeDraftBatchProductsSchema
>;

export const requestBatchEstimateRevisionSchema = z.object({
  batchSessionId: z.string().uuid(),
});

export type RequestBatchEstimateRevisionInput = z.infer<
  typeof requestBatchEstimateRevisionSchema
>;

/** Removes a quoted (estimated) bundle that is not in cart; anomalies require acknowledgement. */
export const withdrawQuotedBatchSessionSchema = z.object({
  batchSessionId: z.string().uuid(),
  acknowledgeWithdrawalAnomalies: z.boolean().optional(),
});

export type WithdrawQuotedBatchSessionInput = z.infer<
  typeof withdrawQuotedBatchSessionSchema
>;

export const saveAdminBatchQuoteEstimateSchema = z.object({
  batchSessionId: z.string().uuid(),
  siteMerchandiseCents: z.number().int().min(0).max(500_000_000),
  siteShippingCents: z.number().int().min(0).max(50_000_000),
  siteSaleTaxCents: z.number().int().min(0).max(50_000_000),
});

export type SaveAdminBatchQuoteEstimateInput = z.infer<
  typeof saveAdminBatchQuoteEstimateSchema
>;
