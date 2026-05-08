import { z } from "zod";

export const abandonStripeCheckoutSchema = z.object({
  checkoutSessionId: z.string().min(1),
});

export type AbandonStripeCheckoutInput = z.infer<typeof abandonStripeCheckoutSchema>;
