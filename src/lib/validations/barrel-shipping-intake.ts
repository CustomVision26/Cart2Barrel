import { z } from "zod";

export const barrelShippingDeliveryMethodSchema = z.enum([
  "customs_pickup",
  "broker_delivery",
]);

export type BarrelShippingDeliveryMethod = z.infer<
  typeof barrelShippingDeliveryMethodSchema
>;

export const submitBarrelShippingIntakeSchema = z
  .object({
    barrelId: z.string().uuid(),
    deliveryMethod: barrelShippingDeliveryMethodSchema,
    brokerKey: z.string().trim().min(1).nullable().optional(),
    courierKey: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod === "broker_delivery" && !value.brokerKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brokerKey"],
        message: "Choose a selected broker for this destination country.",
      });
    }
    if (!value.courierKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courierKey"],
        message: "Choose a local courier or provide your own transportation.",
      });
    }
  });

export type SubmitBarrelShippingIntakeInput = z.infer<
  typeof submitBarrelShippingIntakeSchema
>;

export const cancelBarrelShippingIntakeSchema = z.object({
  intakeId: z.string().uuid(),
});

export type CancelBarrelShippingIntakeInput = z.infer<
  typeof cancelBarrelShippingIntakeSchema
>;

export const updateBarrelShippingIntakeSchema = z
  .object({
    intakeId: z.string().uuid(),
    deliveryMethod: barrelShippingDeliveryMethodSchema,
    brokerKey: z.string().trim().min(1).nullable().optional(),
    courierKey: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod === "broker_delivery" && !value.brokerKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brokerKey"],
        message: "Choose a selected broker for this destination country.",
      });
    }
    if (!value.courierKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courierKey"],
        message: "Choose a local courier or provide your own transportation.",
      });
    }
  });

export type UpdateBarrelShippingIntakeInput = z.infer<
  typeof updateBarrelShippingIntakeSchema
>;

export const switchBarrelShippingIntakeToSelfClearanceSchema = z.object({
  intakeId: z.string().uuid(),
});

export type SwitchBarrelShippingIntakeToSelfClearanceInput = z.infer<
  typeof switchBarrelShippingIntakeToSelfClearanceSchema
>;

export const switchBarrelShippingIntakeToOwnTransportSchema = z.object({
  intakeId: z.string().uuid(),
});

export type SwitchBarrelShippingIntakeToOwnTransportInput = z.infer<
  typeof switchBarrelShippingIntakeToOwnTransportSchema
>;
