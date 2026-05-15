import { z } from "zod";

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

export const confirmCompanyPurchaseSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
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
  });

export type ConfirmCompanyPurchaseInput = z.infer<
  typeof confirmCompanyPurchaseSchema
>;

/** Same fields as approving purchase — admins may clear or revise tracking anytime after purchase is recorded. */
export const updateOrderItemPurchaseTrackingSchema =
  confirmCompanyPurchaseSchema.extend({
    /** `return`: problem receipt or return-in-transit line — updates fulfillment and audit trail. */
    purpose: z.enum(["inbound", "return"]).optional().default("inbound"),
  });

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
