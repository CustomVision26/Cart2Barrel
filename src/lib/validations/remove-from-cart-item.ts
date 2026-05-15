import { z } from "zod";

export const removeFromCartLineSchema = z.object({
  itemRequestId: z.string().uuid(),
  disposition: z.enum(["permanent_remove", "return_to_quoted"]),
});

export type RemoveFromCartLineInput = z.infer<typeof removeFromCartLineSchema>;
