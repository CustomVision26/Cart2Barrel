import { z } from "zod";

export const warehouseBarcodeImageOrderItemSchema = z.object({
  orderItemId: z.string().uuid(),
});

export type WarehouseBarcodeImageOrderItemInput = z.infer<
  typeof warehouseBarcodeImageOrderItemSchema
>;
