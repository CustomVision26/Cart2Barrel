import { z } from "zod";

import { ORDER_ITEM_REFUND_REASON_KIND_VALUES } from "@/lib/validations/order-item-refund-request";

export const ORDER_CONTAINER_REFUND_CHARGE_VALUES = [
  "container",
  "packing_fee",
] as const;

export type OrderContainerRefundChargeValue =
  (typeof ORDER_CONTAINER_REFUND_CHARGE_VALUES)[number];

export const submitCustomerContainerRefundRequestSchema = z.object({
  orderContainerItemId: z.string().uuid(),
  chargeTargets: z
    .array(z.enum(ORDER_CONTAINER_REFUND_CHARGE_VALUES))
    .min(1, "Select at least one charge to refund."),
  reasonKind: z.enum(ORDER_ITEM_REFUND_REASON_KIND_VALUES),
  details: z
    .string()
    .trim()
    .min(40, "Please provide at least 40 characters explaining the refund request."),
  acknowledgeProcessing: z.literal(true),
});

export type SubmitCustomerContainerRefundRequestInput = z.infer<
  typeof submitCustomerContainerRefundRequestSchema
>;

export const cancelCustomerContainerRefundRequestSchema = z.object({
  orderContainerItemId: z.string().uuid(),
});

export type CancelCustomerContainerRefundRequestInput = z.infer<
  typeof cancelCustomerContainerRefundRequestSchema
>;

export const approveOrderContainerLineRefundSchema = z.object({
  orderContainerItemId: z.string().uuid(),
});

export type ApproveOrderContainerLineRefundInput = z.infer<
  typeof approveOrderContainerLineRefundSchema
>;

export const rejectOrderContainerLineRefundSchema = z.object({
  orderContainerItemId: z.string().uuid(),
  rejectionNote: z
    .string()
    .trim()
    .min(10, "Please leave a brief note for the customer (internal record)."),
});

export type RejectOrderContainerLineRefundInput = z.infer<
  typeof rejectOrderContainerLineRefundSchema
>;
