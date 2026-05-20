import { z } from "zod";

export const barrelShippingDeliveryMethodSchema = z.enum([
  "customs_pickup",
  "broker_delivery",
]);

export type BarrelShippingDeliveryMethod = z.infer<
  typeof barrelShippingDeliveryMethodSchema
>;

/** Stored on intake rows while delivery method selection is not in the customer UI. */
export const BARREL_SHIPPING_INTAKE_PLACEHOLDER_DELIVERY_METHOD =
  "customs_pickup" as const satisfies BarrelShippingDeliveryMethod;

export const submitBarrelShippingIntakeSchema = z.object({
  barrelId: z.string().uuid(),
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
