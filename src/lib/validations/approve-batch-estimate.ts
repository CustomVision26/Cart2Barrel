import { z } from "zod";

export const approveBatchEstimateSchema = z.object({
  batchSessionId: z.string().uuid(),
});

export type ApproveBatchEstimateInput = z.infer<typeof approveBatchEstimateSchema>;
