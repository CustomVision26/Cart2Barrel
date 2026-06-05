import { z } from "zod";

export const outsidePurchaseMissingResolutionSchema = z.object({
  itemRequestId: z.string().uuid(),
  resolved: z.boolean(),
});

export type OutsidePurchaseMissingResolutionInput = z.infer<
  typeof outsidePurchaseMissingResolutionSchema
>;
