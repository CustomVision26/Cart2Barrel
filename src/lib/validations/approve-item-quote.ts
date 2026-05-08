import { z } from "zod";

export const approveItemQuoteSchema = z.object({
  itemRequestId: z.string().uuid(),
});

export type ApproveItemQuoteInput = z.infer<typeof approveItemQuoteSchema>;
