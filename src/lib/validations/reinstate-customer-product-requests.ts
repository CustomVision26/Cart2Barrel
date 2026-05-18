import { z } from "zod";

export const reinstateCustomerProductRequestsSchema = z.object({
  itemRequestIds: z.array(z.string().uuid()).min(1).max(50),
});

export type ReinstateCustomerProductRequestsInput = z.infer<
  typeof reinstateCustomerProductRequestsSchema
>;
