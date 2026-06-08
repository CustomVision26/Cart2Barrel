import { z } from "zod";

import { productReturnDesiredOutcomeSchema } from "@/lib/product-return-desired-outcome";

export const submitProductReturnRequestSchema = z.object({
  orderItemId: z.string().uuid(),
  desiredOutcome: productReturnDesiredOutcomeSchema,
  returnNote: z
    .string()
    .trim()
    .min(
      20,
      "Please explain why you are requesting a return (at least 20 characters).",
    )
    .max(2000),
  acknowledgeChargesMayApply: z.literal(true),
});

export type SubmitProductReturnRequestInput = z.infer<
  typeof submitProductReturnRequestSchema
>;

export const adminFulfillProductReturnRequestSchema = z
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
    retailerTrackingCompany: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    retailerTrackingNumber: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    customerNotes: z
      .string()
      .trim()
      .min(1, "Add a note for the customer.")
      .max(2000),
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
    const hasTracking =
      Boolean(data.trackingUrl) || (hasCompany && hasNumber);
    if (!hasTracking) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Add a return tracking URL or both carrier name and tracking number.",
        path: ["trackingUrl"],
      });
    }
  });

export type AdminFulfillProductReturnRequestInput = z.infer<
  typeof adminFulfillProductReturnRequestSchema
>;

export const cancelProductReturnRequestSchema = z.object({
  orderItemId: z.string().uuid(),
});

export type CancelProductReturnRequestInput = z.infer<
  typeof cancelProductReturnRequestSchema
>;
