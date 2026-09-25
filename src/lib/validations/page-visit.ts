import { z } from "zod";

export const recordPageVisitSchema = z.object({
  path: z.string().trim().min(1, "Path is required.").max(2048),
  referrer: z.string().trim().max(2000).nullable().optional(),
});

export type RecordPageVisitInput = z.infer<typeof recordPageVisitSchema>;
