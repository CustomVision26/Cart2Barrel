import type { BarrelContentItem } from "@/lib/barrel-contents";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import type { BarrelOutboundShipmentTrackingView } from "@/lib/barrel-shipment-tracking";
import type { BarrelStatus } from "@/lib/barrel-container-types";
import type { BarrelShippingDeliveryMethod } from "@/lib/validations/barrel-shipping-intake";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

export type ShippingHistoryAudience = "customer" | "admin";

export type ShippingHistoryRow = {
  barrelId: string;
  clerkUserId: string;
  customerName: string | null;
  customerEmail: string | null;
  alias: string;
  slotLabel: string;
  containerName: string;
  containerImageUrl: string | null;
  kind: ContainerOfferingKind;
  status: BarrelStatus;
  historyAt: string;
  deliveryMethod: BarrelShippingDeliveryMethod | null;
  selectedBrokerKey: string | null;
  selectedCourierKey: string | null;
  destinationCountry: string | null;
  outboundCharges: BarrelOutboundShippingChargeView[];
  shipmentTracking: BarrelOutboundShipmentTrackingView | null;
  contents: BarrelContentItem[];
};
