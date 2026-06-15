import { z } from "zod";

import {
  warehouseMissingReasonSchema,
  warehouseReceiveConditionSchema,
} from "@/lib/validations/admin-warehouse-receipt";

const optionalTrimmed = (max: number) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? undefined : t;
    },
    z.string().max(max).optional(),
  );

const retailerTrackingPairRefine = (
  data: {
    retailerTrackingCompany?: string;
    retailerTrackingNumber?: string;
  },
  ctx: z.RefinementCtx,
) => {
  const hasCompany = Boolean(data.retailerTrackingCompany);
  const hasNumber = Boolean(data.retailerTrackingNumber);
  if (hasNumber && !hasCompany) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter the tracking company when a tracking number is provided.",
      path: ["retailerTrackingCompany"],
    });
  }
  if (hasCompany && !hasNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter the tracking number when a tracking company is provided.",
      path: ["retailerTrackingNumber"],
    });
  }
};

const companyPurchaseTrackingFields = z.object({
  orderItemId: z.string().uuid(),
  trackingUrl: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? undefined : t;
    },
    z.string().url().max(2048).optional(),
  ),
  retailerTrackingCompany: optionalTrimmed(120),
  retailerTrackingNumber: optionalTrimmed(200),
});

function withRetailerTrackingPairRefine<
  T extends {
    retailerTrackingCompany?: string;
    retailerTrackingNumber?: string;
  },
>(schema: z.ZodType<T>) {
  return schema.superRefine(retailerTrackingPairRefine);
}

const confirmCompanyPurchaseTrackingBase = companyPurchaseTrackingFields.extend({
  deliveryMode: z.literal("tracking"),
});

export const confirmCompanyPurchaseTrackingSchema = withRetailerTrackingPairRefine(
  confirmCompanyPurchaseTrackingBase,
);

export const confirmCompanyPurchaseStorePickupSchema = z.object({
  deliveryMode: z.literal("store_pickup"),
  orderItemId: z.string().uuid(),
  storePickupAt: z.string().datetime({ offset: true }),
  receivedQty: z.number().int().min(0).max(1_000_000),
  condition: warehouseReceiveConditionSchema,
  missingReason: warehouseMissingReasonSchema.optional(),
  shelfLocation: z.string().max(500),
  proofPhotoCount: z.number().int().min(0).max(500),
  proofPhotoUrls: z.array(z.string().url()).max(12).optional(),
  barcodeValue: optionalTrimmed(500),
  conditionNotes: optionalTrimmed(2000),
});

export const confirmCompanyPurchaseSchema = z
  .discriminatedUnion("deliveryMode", [
    confirmCompanyPurchaseTrackingBase,
    confirmCompanyPurchaseStorePickupSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.deliveryMode === "tracking") {
      retailerTrackingPairRefine(data, ctx);
    }
  });

export type ConfirmCompanyPurchaseInput = z.infer<
  typeof confirmCompanyPurchaseSchema
>;

export type ConfirmCompanyPurchaseTrackingInput = z.infer<
  typeof confirmCompanyPurchaseTrackingSchema
>;

export type ConfirmCompanyPurchaseStorePickupInput = z.infer<
  typeof confirmCompanyPurchaseStorePickupSchema
>;

/** Same fields as approving purchase — admins may clear or revise tracking anytime after purchase is recorded. */
export const updateOrderItemPurchaseTrackingSchema = withRetailerTrackingPairRefine(
  companyPurchaseTrackingFields.extend({
    /** `return`: problem receipt or return-in-transit line — updates fulfillment and audit trail. */
    purpose: z.enum(["inbound", "return"]).optional().default("inbound"),
  }),
);

export type UpdateOrderItemPurchaseTrackingInput = z.infer<
  typeof updateOrderItemPurchaseTrackingSchema
>;

export const requestDeliverySchema = z.object({
  orderItemId: z.string().uuid(),
});

export type RequestDeliveryInput = z.infer<typeof requestDeliverySchema>;

export const refundOrderLineSchema = z.object({
  orderItemId: z.string().uuid(),
  /** Partial or full line refund in USD cents (prorate up to remaining line and PI balance). */
  amountCents: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export type RefundOrderLineInput = z.infer<typeof refundOrderLineSchema>;

export const removeRetailerReceiptImageSchema = z.object({
  orderItemId: z.string().uuid(),
  imageUrl: z.string().url().max(4096),
});

export type RemoveRetailerReceiptImageInput = z.infer<
  typeof removeRetailerReceiptImageSchema
>;
