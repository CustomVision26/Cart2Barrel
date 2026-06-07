import { z } from "zod";

export const outsidePurchasePublishActionSchema = z.object({
  itemRequestId: z.string().uuid(),
});

export type OutsidePurchasePublishActionInput = z.infer<
  typeof outsidePurchasePublishActionSchema
>;
