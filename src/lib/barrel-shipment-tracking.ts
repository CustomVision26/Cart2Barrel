/** Post-payment outbound container logistics stages (admin-set, customer-visible). */
export const BARREL_OUTBOUND_SHIPMENT_STAGES = [
  "awaiting_customs_clearance",
  "ready_for_shipment",
  "picked_up",
  "at_shipping_warehouse",
  "on_vessel",
  "arrived_destination",
  "customs_processing",
  "cleared_customs",
  "delivered",
] as const;

export type BarrelOutboundShipmentStage =
  (typeof BARREL_OUTBOUND_SHIPMENT_STAGES)[number];

/** Stages shown on the customer/admin timeline (excludes internal awaiting_customs). */
export const BARREL_SHIPMENT_TIMELINE_STAGES = [
  "ready_for_shipment",
  "picked_up",
  "at_shipping_warehouse",
  "on_vessel",
  "arrived_destination",
  "customs_processing",
  "cleared_customs",
  "delivered",
] as const satisfies readonly BarrelOutboundShipmentStage[];

export const BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS: Record<
  BarrelOutboundShipmentStage,
  string
> = {
  awaiting_customs_clearance: "Awaiting customs clearance info",
  ready_for_shipment: "Ready for shipment",
  picked_up: "Picked up",
  at_shipping_warehouse: "At shipping warehouse",
  on_vessel: "On vessel",
  arrived_destination: "Arrived in destination country",
  customs_processing: "Customs processing",
  cleared_customs: "Cleared customs",
  delivered: "Delivered",
};

export function barrelShipmentStageIndex(stage: BarrelOutboundShipmentStage): number {
  return BARREL_OUTBOUND_SHIPMENT_STAGES.indexOf(stage);
}

export function isBarrelShipmentStage(value: string): value is BarrelOutboundShipmentStage {
  return (BARREL_OUTBOUND_SHIPMENT_STAGES as readonly string[]).includes(value);
}

export function hasCustomsClearanceInfo(input: {
  customsDeclarationFormUrl: string | null;
  freightCompanyName: string | null;
}): boolean {
  return Boolean(
    input.customsDeclarationFormUrl?.trim() || input.freightCompanyName?.trim(),
  );
}

export type BarrelOutboundShipmentTrackingView = {
  barrelId: string;
  trackingStage: BarrelOutboundShipmentStage;
  stageUpdatedAt: string;
  customsDeclarationFormUrl: string | null;
  freightCompanyName: string | null;
  freightDropOffAt: string | null;
  estimatedArrivalAt: string | null;
};
