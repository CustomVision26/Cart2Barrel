import { z } from "zod";

export const removeBatchFromCartSchema = z.object({
  batchSessionId: z.string().uuid(),
  disposition: z.enum(["withdraw_forever", "return_to_batch_quotes"]),
});

export type RemoveBatchFromCartInput = z.infer<typeof removeBatchFromCartSchema>;
