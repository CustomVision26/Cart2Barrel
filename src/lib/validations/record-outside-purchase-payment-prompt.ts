import { z } from "zod";

export const recordOutsidePurchasePaymentPromptSchema = z.object({
  itemRequestId: z.string().uuid(),
});

export type RecordOutsidePurchasePaymentPromptInput = z.infer<
  typeof recordOutsidePurchasePaymentPromptSchema
>;
