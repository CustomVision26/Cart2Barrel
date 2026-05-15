import { z } from "zod";

export const ORDER_ITEM_REFUND_REASON_KIND_VALUES = [
  "defective_or_damaged",
  "wrong_item",
  "not_received",
  "not_as_described",
  "duplicate_charge",
  "changed_mind",
  "other",
] as const;

export type OrderItemRefundReasonKindValue =
  (typeof ORDER_ITEM_REFUND_REASON_KIND_VALUES)[number];

export const submitCustomerRefundRequestSchema = z.object({
  orderItemId: z.string().uuid(),
  reasonKind: z.enum(ORDER_ITEM_REFUND_REASON_KIND_VALUES),
  details: z
    .string()
    .trim()
    .min(40, "Please provide at least 40 characters explaining the refund request."),
  /** true = remaining line refundable total; false = use requestedAmountUsd */
  refundFullLineRemainder: z.boolean(),
  /**
   * USD dollars as decimal string (e.g. "12.34") when not full remainder;
   * ignored when refundFullLineRemainder is true.
   */
  requestedAmountUsd: z.string().trim().optional(),
  acknowledgeProcessing: z.literal(true),
});

export type SubmitCustomerRefundRequestInput = z.infer<
  typeof submitCustomerRefundRequestSchema
>;

export const approveRefundRequestSchema = z.object({
  refundRequestId: z.string().uuid(),
  /** Approved Stripe refund amount in USD cents; capped server-side */
  approvedAmountCents: z.number().int().positive(),
});

export type ApproveRefundRequestInput = z.infer<typeof approveRefundRequestSchema>;

export const rejectRefundRequestSchema = z.object({
  refundRequestId: z.string().uuid(),
  rejectionNote: z
    .string()
    .trim()
    .min(10, "Please leave a brief note for the customer (internal record)."),
});

export type RejectRefundRequestInput = z.infer<typeof rejectRefundRequestSchema>;
