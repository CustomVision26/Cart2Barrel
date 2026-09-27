import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import type { BarrelContentItem } from "@/lib/barrel-contents";
import type { BarrelShippingDeliveryMethod } from "@/lib/validations/barrel-shipping-intake";
import type { BarrelStatus } from "@/lib/barrel-container-types";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

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
