import { z } from "zod";

import { BARREL_OUTBOUND_SHIPMENT_STAGES } from "@/lib/barrel-shipment-tracking";

export const adminUpdateBarrelShipmentStageSchema = z.object({
  barrelId: z.string().uuid(),
  trackingStage: z.enum(BARREL_OUTBOUND_SHIPMENT_STAGES),
});

export type AdminUpdateBarrelShipmentStageInput = z.infer<
  typeof adminUpdateBarrelShipmentStageSchema
>;

export const adminSaveBarrelShipmentCustomsSchema = z.object({
  barrelId: z.string().uuid(),
  freightCompanyName: z.string().trim().min(1).max(200),
  freightDropOffAt: z.string().min(1).max(64),
  estimatedArrivalAt: z.string().min(1).max(64),
  customsDeclarationFormUrl: z.string().url().max(4096).optional().nullable(),
});

export type AdminSaveBarrelShipmentCustomsInput = z.infer<
  typeof adminSaveBarrelShipmentCustomsSchema
>;
