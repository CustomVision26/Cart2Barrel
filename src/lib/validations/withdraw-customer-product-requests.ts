import { z } from "zod";

export const withdrawCustomerProductRequestsSchema = z.object({
  itemRequestIds: z.array(z.string().uuid()).min(1).max(50),
});

export type WithdrawCustomerProductRequestsInput = z.infer<
  typeof withdrawCustomerProductRequestsSchema
>;
