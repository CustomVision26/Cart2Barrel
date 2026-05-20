import { z } from "zod";

import { RETAILER_RECEIPT_IMAGES_MAX } from "@/lib/retailer-receipt-images";

export const warehouseReceiveConditionSchema = z.enum([
  "good",
  "damaged",
  "missing",
  "wrong_item",
]);

export const warehouseReceiptLineInputSchema = z.object({
  orderItemId: z.string().uuid(),
  receivedQty: z.number().int().min(0).max(1_000_000),
  condition: warehouseReceiveConditionSchema,
  shelfLocation: z.string().max(500),
  proofPhotoCount: z.number().int().min(0).max(500),
  proofPhotoUrls: z
    .array(z.string().url())
    .max(RETAILER_RECEIPT_IMAGES_MAX)
    .optional(),
  barcodeValue: z.string().max(500).optional(),
});

export const saveWarehouseReceiptSnapshotsSchema = z
  .object({
    lines: z.array(warehouseReceiptLineInputSchema).min(1).max(100),
  })
  .superRefine((val, ctx) => {
    const ids = val.lines.map((l) => l.orderItemId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each order line may only appear once per save.",
      });
    }
  });

export type SaveWarehouseReceiptSnapshotsInput = z.infer<
  typeof saveWarehouseReceiptSnapshotsSchema
>;

export const warehouseReceiptMemoV1Schema = z.object({
  kind: z.literal("warehouse_receipt_v1"),
  orderItemId: z.string().uuid(),
  orderedQty: z.number().int().min(0),
  receivedQty: z.number().int().min(0),
  condition: warehouseReceiveConditionSchema,
  shelfLocation: z.string(),
  proofPhotoCount: z.number().int().min(0),
  barcodeValue: z.string().optional(),
});

export type WarehouseReceiptMemoV1 = z.infer<typeof warehouseReceiptMemoV1Schema>;
