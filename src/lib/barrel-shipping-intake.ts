import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import { paidOutboundCharges } from "@/lib/barrel-outbound-shipping-charge";
import type { BarrelContentItem } from "@/lib/barrel-contents";
import type { BarrelShippingDeliveryMethod } from "@/lib/validations/barrel-shipping-intake";
import type { BarrelStatus } from "@/lib/barrel-container-types";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  BARREL_OUTBOUND_SHIPMENT_STAGES,
  type BarrelOutboundShipmentStage,
} from "@/lib/barrel-shipment-tracking";
import {
  isOwnTransportCourierKey,
  PUBLISHED_COURIER_KEY,
} from "@/lib/destination-clearance-partners";

export type BarrelShippingIntakeContainerRow = {
  barrelId: string;
  alias: string;
  slotLabel: string;
  /** Container catalog name at purchase (for labels and thumbnail alt text). */
  containerName: string;
  /** Primary offering image URL when the container is linked to a catalog SKU. */
  containerImageUrl: string | null;
  kind: ContainerOfferingKind;
  status: BarrelStatus;
  capacityPercentage: number;
  itemCount: number;
  /** Products packed in this container (owner-scoped). */
  contents: BarrelContentItem[];
  /** Admin-published freight / broker / courier charges for this container. */
  outboundCharges: BarrelOutboundShippingChargeView[];
};

export type BarrelShippingIntakeSubmittedRow = BarrelShippingIntakeContainerRow & {
  intakeId: string;
  deliveryMethod: BarrelShippingDeliveryMethod;
  selectedBrokerKey: string | null;
  selectedCourierKey: string | null;
  contactPhone: string | null;
  specialInstructions: string | null;
  submittedAt: string;
};

export function isContainerReadyForShippingIntake(
  barrel: Pick<BarrelShippingIntakeContainerRow, "status" | "capacityPercentage">,
): boolean {
  if (barrel.status === "shipped" || barrel.status === "delivered") {
    return false;
  }
  return barrel.capacityPercentage >= 100 || barrel.status === "ready_to_ship";
}

/** Active containers that should show the outbound charges / clearance UI. */
export function isContainerVisibleOnShipping(
  barrel: Pick<BarrelShippingIntakeContainerRow, "status">,
): boolean {
  return barrel.status !== "shipped" && barrel.status !== "delivered";
}

export function canCancelShippingIntake(
  barrel: Pick<BarrelShippingIntakeContainerRow, "status">,
): boolean {
  return barrel.status !== "shipped" && barrel.status !== "delivered";
}

export function containerFullnessLabel(
  barrel: Pick<BarrelShippingIntakeContainerRow, "status" | "capacityPercentage">,
): string {
  if (barrel.status === "ready_to_ship") {
    return "Marked full — ready to ship";
  }
  if (barrel.capacityPercentage >= 100) {
    return "At 100% load";
  }
  return `${barrel.capacityPercentage}% load`;
}

export function barrelShippingDeliveryMethodLabel(
  method: BarrelShippingDeliveryMethod,
): string {
  switch (method) {
    case "customs_pickup":
      return "Self-clearance at destination customs";
    case "broker_delivery":
      return "Destination customs broker";
    default: {
      const _x: never = method;
      return _x;
    }
  }
}

export function barrelShippingDeliveryMethodShortLabel(
  method: BarrelShippingDeliveryMethod,
): string {
  switch (method) {
    case "customs_pickup":
      return "Self-clearance";
    case "broker_delivery":
      return "Destination broker";
    default: {
      const _x: never = method;
      return _x;
    }
  }
}

/** True after at least one outbound charge on this container has been paid. */
export function shippingIntakeHasPaidOutbound(
  row: Pick<BarrelShippingIntakeContainerRow, "outboundCharges">,
): boolean {
  return paidOutboundCharges(row.outboundCharges).length > 0;
}

const SYNTHETIC_PAID_INTAKE_PREFIX = "paid-tracking-";

export function isSyntheticPaidShippingIntakeId(intakeId: string): boolean {
  return intakeId.startsWith(SYNTHETIC_PAID_INTAKE_PREFIX);
}

/** Tracking card row for a paid container, even when confirmation was cancelled. */
export function toPaidShippingTrackingRow(
  row: BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow,
): BarrelShippingIntakeSubmittedRow {
  if ("intakeId" in row && typeof row.intakeId === "string") {
    return row;
  }
  const paidAt =
    paidOutboundCharges(row.outboundCharges)[0]?.paidAt ??
    new Date().toISOString();
  return {
    ...row,
    intakeId: `${SYNTHETIC_PAID_INTAKE_PREFIX}${row.barrelId}`,
    deliveryMethod: "broker_delivery",
    selectedBrokerKey: null,
    selectedCourierKey: null,
    contactPhone: null,
    specialInstructions: null,
    submittedAt: paidAt,
  };
}

export function shippingIntakeTrackingStage(
  row: Pick<BarrelShippingIntakeContainerRow, "outboundCharges">,
): BarrelOutboundShipmentStage {
  const paid = paidOutboundCharges(row.outboundCharges);
  const tracking =
    paid[0]?.shipmentTracking ??
    row.outboundCharges[0]?.shipmentTracking ??
    null;
  return tracking?.trackingStage ?? "awaiting_customs_clearance";
}

export function shippingIntakeTrackingStageLabel(
  row: Pick<BarrelShippingIntakeContainerRow, "outboundCharges">,
): string {
  return BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[shippingIntakeTrackingStage(row)];
}

export type ThirdPartyTransportationStatus = {
  kind: "added" | "own" | "not_added";
  companyName: string | null;
  paid: boolean;
  pendingReview: boolean;
  summary: string;
};

export function describeThirdPartyTransportation(input: {
  selectedCourierKey?: string | null;
  outboundCharges: readonly Pick<
    BarrelOutboundShippingChargeView,
    | "chargeKind"
    | "partnerName"
    | "paidAt"
    | "offPlatformSubmittedAt"
  >[];
}): ThirdPartyTransportationStatus {
  if (isOwnTransportCourierKey(input.selectedCourierKey)) {
    return {
      kind: "own",
      companyName: null,
      paid: false,
      pendingReview: false,
      summary:
        "Third-party transportation is not added. Customer provides their own transportation.",
    };
  }
  const courier = input.outboundCharges.find(
    (charge) => charge.chargeKind === "courier",
  );
  const paid = Boolean(courier?.paidAt);
  const optedIn = input.selectedCourierKey === PUBLISHED_COURIER_KEY || paid;
  if (!optedIn) {
    return {
      kind: "not_added",
      companyName: null,
      paid: false,
      pendingReview: false,
      summary: "Third-party transportation is not added yet.",
    };
  }
  const companyName = courier?.partnerName?.trim() || null;
  const pendingReview = Boolean(courier?.offPlatformSubmittedAt) && !paid;
  const name = companyName ?? "local courier";
  return {
    kind: "added",
    companyName,
    paid,
    pendingReview,
    summary: paid
      ? `Third-party transportation is added: ${name} (paid).`
      : pendingReview
        ? `Third-party transportation is added: ${name} (awaiting payment verification).`
        : `Third-party transportation is added: ${name}.`,
  };
}

export function compareShippingIntakeTrackingStage(
  a: BarrelOutboundShipmentStage,
  b: BarrelOutboundShipmentStage,
): number {
  return (
    BARREL_OUTBOUND_SHIPMENT_STAGES.indexOf(a) -
    BARREL_OUTBOUND_SHIPMENT_STAGES.indexOf(b)
  );
}
