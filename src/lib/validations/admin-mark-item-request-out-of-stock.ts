import { z } from "zod";

import { OUT_OF_STOCK_STAFF_NOTE_MAX_LENGTH } from "@/lib/out-of-stock-staff-attachments";

export const adminMarkItemRequestOutOfStockSchema = z.object({
  itemRequestId: z.string().uuid(),
  staffNote: z
    .string()
    .trim()
    .max(OUT_OF_STOCK_STAFF_NOTE_MAX_LENGTH)
    .optional(),
  attachmentImageUrls: z.array(z.string().url()).max(6).optional(),
});

export type AdminMarkItemRequestOutOfStockInput = z.infer<
  typeof adminMarkItemRequestOutOfStockSchema
>;
