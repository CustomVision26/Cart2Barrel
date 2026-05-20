import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
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
};

export type BarrelShippingIntakeSubmittedRow = BarrelShippingIntakeContainerRow & {
  intakeId: string;
  deliveryMethod: BarrelShippingDeliveryMethod;
  contactPhone: string | null;
  specialInstructions: string | null;
  submittedAt: string;
  /** Set when admin published outbound shipping costs for this container. */
  outboundCharge: BarrelOutboundShippingChargeView | null;
};

export function isContainerReadyForShippingIntake(
  barrel: Pick<BarrelShippingIntakeContainerRow, "status" | "capacityPercentage">,
): boolean {
  if (barrel.status === "shipped" || barrel.status === "delivered") {
    return false;
  }
  return barrel.capacityPercentage >= 100 || barrel.status === "ready_to_ship";
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
      return "I will pick up at customs myself";
    case "broker_delivery":
      return "Broker clears customs and delivers to my address";
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
      return "Customs pickup";
    case "broker_delivery":
      return "Broker delivery";
    default: {
      const _x: never = method;
      return _x;
    }
  }
}
