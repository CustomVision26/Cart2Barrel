import { z } from "zod";

export const adminMarkItemRequestOutOfStockSchema = z.object({
  itemRequestId: z.string().uuid(),
});

export type AdminMarkItemRequestOutOfStockInput = z.infer<
  typeof adminMarkItemRequestOutOfStockSchema
>;
