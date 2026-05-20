import { z } from "zod";

export const acceptDeliveryConditionForBarrelSchema = z.object({
  orderItemId: z.string().uuid(),
});

export type AcceptDeliveryConditionForBarrelInput = z.infer<
  typeof acceptDeliveryConditionForBarrelSchema
>;
