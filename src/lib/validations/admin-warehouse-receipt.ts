import { z } from "zod";

import { RETAILER_RECEIPT_IMAGES_MAX } from "@/lib/retailer-receipt-images";

export const warehouseReceiveConditionSchema = z.enum([
  "good",
  "damaged",
  "missing",
  "wrong_item",
]);

export const warehouseMissingReasonSchema = z.enum([
  "package_empty",
  "package_not_received",
]);

export const warehouseReceiptLineInputSchema = z.object({
  orderItemId: z.string().uuid(),
  receivedQty: z.number().int().min(0).max(1_000_000),
  condition: warehouseReceiveConditionSchema,
  /** Sub-reason captured only when `condition` is `missing`. */
  missingReason: warehouseMissingReasonSchema.optional(),
  shelfLocation: z.string().max(500),
  proofPhotoCount: z.number().int().min(0).max(500),
  proofPhotoUrls: z
    .array(z.string().url())
    .max(RETAILER_RECEIPT_IMAGES_MAX)
    .optional(),
  barcodeValue: z.string().max(500).optional(),
  conditionNotes: z.string().max(2000).optional(),
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

/** Versioned intake record with sequence + role (active vs frozen prior intake). */
export const warehouseReceiptMemoV2Schema = z.object({
  kind: z.literal("warehouse_receipt_v2"),
  orderItemId: z.string().uuid(),
  intakeSequence: z.number().int().min(1).max(999),
  intakeRole: z.enum(["active", "prior"]),
  intakeContext: z.enum(["initial_inbound", "replacement_after_return"]).optional(),
  recordedAt: z.string().min(1).max(64),
  orderedQty: z.number().int().min(0),
  receivedQty: z.number().int().min(0),
  condition: warehouseReceiveConditionSchema,
  missingReason: warehouseMissingReasonSchema.optional(),
  shelfLocation: z.string(),
  proofPhotoCount: z.number().int().min(0),
  proofPhotoUrls: z.array(z.string().url()).max(RETAILER_RECEIPT_IMAGES_MAX).optional(),
  barcodeValue: z.string().optional(),
  barcodeImageUrl: z.string().url().optional(),
  conditionNotes: z.string().max(2000).optional(),
});

export type WarehouseReceiptMemoV2 = z.infer<typeof warehouseReceiptMemoV2Schema>;

export const warehouseReceiptMemoSchema = z.discriminatedUnion("kind", [
  warehouseReceiptMemoV1Schema,
  warehouseReceiptMemoV2Schema,
]);

export type WarehouseReceiptMemo = z.infer<typeof warehouseReceiptMemoSchema>;
