import type { BarrelStatus } from "@/lib/barrel-container-types";
import type { BarrelOutboundShipmentTrackingView } from "@/lib/barrel-shipment-tracking";
import type { BarrelShippingDeliveryMethod } from "@/lib/validations/barrel-shipping-intake";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

export { ADMIN_OUTBOUND_SHIPPING_CHARGE_LABELS as DEFAULT_OUTBOUND_SHIPPING_CHARGE_LABELS } from "@/lib/outbound-shipping-expected-charges";

export type OutboundShippingChargeLineView = {
  label: string;
  amountCents: number;
};

export type BarrelOutboundShippingChargeView = {
  chargeId: string;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  adminNote: string | null;
  inCart: boolean;
  paidAt: string | null;
  paymentReferenceNumber: string | null;
  shipmentTracking: BarrelOutboundShipmentTrackingView | null;
};

export type AdminBarrelOutboundShippingChargeRow = {
  barrelId: string;
  intakeId: string;
  clerkUserId: string;
  customerEmail: string | null;
  customerName: string | null;
  alias: string;
  slotLabel: string;
  containerName: string;
  containerImageUrl: string | null;
  kind: ContainerOfferingKind;
  status: BarrelStatus;
  capacityPercentage: number;
  /** Full or marked ready — customer may confirm shipping / see published charges. */
  readyForShipping: boolean;
  deliveryMethod: BarrelShippingDeliveryMethod;
  submittedAt: string;
  chargeId: string | null;
  adminNote: string | null;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  paidAt: string | null;
  paymentReferenceNumber: string | null;
  shipmentTracking: BarrelOutboundShipmentTrackingView | null;
};

export function sumChargeLineCents(
  lines: Pick<OutboundShippingChargeLineView, "amountCents">[],
): number {
  return lines.reduce((s, l) => s + Math.max(0, l.amountCents), 0);
}

/** Shown on `/admin/shipments` when no live containers qualify yet. */
export const ADMIN_SHIPPING_CHARGE_PREVIEW_ROW: AdminBarrelOutboundShippingChargeRow =
  {
    barrelId: "00000000-0000-4000-8000-000000000001",
    intakeId: "preview",
    clerkUserId: "preview_user",
    customerEmail: "customer@example.com",
    customerName: "Example Customer",
    alias: "Barrel 1",
    slotLabel: "Standard barrel · Slot 1",
    containerName: "Standard barrel",
    containerImageUrl: null,
    kind: "barrel",
    status: "ready_to_ship",
    capacityPercentage: 100,
    readyForShipping: true,
    deliveryMethod: "broker_delivery",
    submittedAt: new Date().toISOString(),
    chargeId: null,
    adminNote: null,
    lines: [],
    totalCents: 0,
    paidAt: null,
    paymentReferenceNumber: null,
    shipmentTracking: null,
  };

export type AdminShipmentCustomerGroup = {
  clerkUserId: string;
  customerName: string | null;
  customerEmail: string | null;
  readyContainers: AdminBarrelOutboundShippingChargeRow[];
  notReadyContainers: AdminBarrelOutboundShippingChargeRow[];
};

export type AdminShipmentChargePageData = {
  customerGroups: AdminShipmentCustomerGroup[];
};
