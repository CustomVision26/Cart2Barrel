import { z } from "zod";

export const addMerchandiseTopupToCartSchema = z.object({
  reconciliationId: z.string().uuid(),
});

export const removeMerchandiseTopupFromCartSchema = z.object({
  reconciliationId: z.string().uuid(),
});

export type AddMerchandiseTopupToCartInput = z.infer<
  typeof addMerchandiseTopupToCartSchema
>;
export type RemoveMerchandiseTopupFromCartInput = z.infer<
  typeof removeMerchandiseTopupFromCartSchema
>;
