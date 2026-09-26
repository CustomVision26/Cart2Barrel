import type { BarrelStatus } from "@/lib/barrel-container-types";
import type { BarrelOutboundShipmentTrackingView } from "@/lib/barrel-shipment-tracking";
import type { BarrelShippingDeliveryMethod } from "@/lib/validations/barrel-shipping-intake";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

export { ADMIN_OUTBOUND_SHIPPING_CHARGE_LABELS as DEFAULT_OUTBOUND_SHIPPING_CHARGE_LABELS } from "@/lib/outbound-shipping-expected-charges";

export const BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS = [
  "freight",
  "broker",
  "courier",
] as const;

export type BarrelOutboundShippingChargeKind =
  (typeof BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS)[number];

export const BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS: Record<
  BarrelOutboundShippingChargeKind,
  string
> = {
  freight: "Freight charge",
  broker: "Broker",
  courier: "Local courier",
};

export const BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_DEFAULT_LABELS: Record<
  BarrelOutboundShippingChargeKind,
  string
> = {
  freight: "Freight / shipper charge",
  broker: "Customs broker clearance",
  courier: "Local courier / pickup",
};

export const FREIGHT_SHIPPER_CHARGE_LABEL = "Freight / shipper charge";
export const FREIGHT_TRANSPORTATION_FEE_LABEL = "Transportation fee";

export type OutboundShippingChargeLineView = {
  label: string;
  amountCents: number;
};

export function isTransportationFeeLabel(label: string): boolean {
  return /transportation/i.test(label.trim());
}

export function splitFreightChargeLines(
  lines: OutboundShippingChargeLineView[] | undefined,
): {
  shipper: OutboundShippingChargeLineView | undefined;
  transportation: OutboundShippingChargeLineView | undefined;
} {
  if (!lines?.length) {
    return { shipper: undefined, transportation: undefined };
  }
  const transportIndex = lines.findIndex((line) =>
    isTransportationFeeLabel(line.label),
  );
  if (transportIndex >= 0) {
    return {
      shipper: lines.find((_, index) => index !== transportIndex) ?? lines[0],
      transportation: lines[transportIndex],
    };
  }
  return {
    shipper: lines[0],
    transportation: lines[1],
  };
}

export const OFF_PLATFORM_PAYMENT_METHODS = [
  "zelle",
  "cashapp",
  "local_office",
] as const;

export type OffPlatformPaymentMethod =
  (typeof OFF_PLATFORM_PAYMENT_METHODS)[number];

export const OFF_PLATFORM_PAYMENT_METHOD_LABELS: Record<
  OffPlatformPaymentMethod,
  string
> = {
  zelle: "Zelle payment",
  cashapp: "Cash App",
  local_office: "Pay charges at the local office",
};

export function isOffPlatformPaymentMethod(
  value: string | null | undefined,
): value is OffPlatformPaymentMethod {
  return (
    value === "zelle" || value === "cashapp" || value === "local_office"
  );
}

export function isOffPlatformOutboundChargeKind(
  kind: BarrelOutboundShippingChargeKind,
): boolean {
  return kind === "broker" || kind === "courier";
}

export function isOffPlatformPaymentPendingReview(
  charge: Pick<
    BarrelOutboundShippingChargeView,
    "paidAt" | "offPlatformSubmittedAt"
  >,
): boolean {
  return Boolean(charge.offPlatformSubmittedAt) && !charge.paidAt;
}

/** Customer picked local office and can still switch to Zelle or Cash App before staff approve. */
export function canSwitchOffPlatformPaymentToTransfer(
  charge: Pick<
    BarrelOutboundShippingChargeView,
    | "paidAt"
    | "offPlatformSubmittedAt"
    | "offPlatformPaymentMethod"
    | "partnerZelleId"
    | "partnerCashappId"
  >,
): boolean {
  return (
    isOffPlatformPaymentPendingReview(charge) &&
    charge.offPlatformPaymentMethod === "local_office" &&
    (Boolean(charge.partnerZelleId?.trim()) ||
      Boolean(charge.partnerCashappId?.trim()))
  );
}

export type BarrelOutboundShippingChargeView = {
  chargeId: string;
  chargeKind: BarrelOutboundShippingChargeKind;
  partnerName: string | null;
  partnerLocation: string | null;
  partnerAddress: string | null;
  partnerCountry: string | null;
  partnerPhone: string | null;
  partnerCashappId: string | null;
  partnerCashappAccount: string | null;
  partnerZelleId: string | null;
  partnerZelleAccount: string | null;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  adminNote: string | null;
  inCart: boolean;
  paidAt: string | null;
  paymentReferenceNumber: string | null;
  paidOrderId: string | null;
  offPlatformPaymentMethod: OffPlatformPaymentMethod | null;
  offPlatformPayerName: string | null;
  offPlatformReceiptUrl: string | null;
  offPlatformSubmittedAt: string | null;
  shipmentTracking: BarrelOutboundShipmentTrackingView | null;
  updatedByClerkUserId?: string | null;
};

export function isBarrelOutboundShippingChargeKind(
  value: string | null | undefined,
): value is BarrelOutboundShippingChargeKind {
  return (
    value === "freight" || value === "broker" || value === "courier"
  );
}

export function unpaidPublishedCharges(
  charges: BarrelOutboundShippingChargeView[],
): BarrelOutboundShippingChargeView[] {
  return charges.filter((c) => !c.paidAt && c.totalCents > 0);
}

function isOwnTransportCourierKey(key: string | null | undefined): boolean {
  const trimmed = key?.trim();
  return trimmed === "own-transport" || trimmed === "self-arrange-local";
}

function chargeMatchesIntakeSelection(
  charge: Pick<BarrelOutboundShippingChargeView, "chargeKind">,
  intake: {
    deliveryMethod: BarrelShippingDeliveryMethod;
    selectedCourierKey?: string | null;
  },
): boolean {
  const wantsBroker = intake.deliveryMethod === "broker_delivery";
  const wantsCourier =
    Boolean(intake.selectedCourierKey?.trim()) &&
    !isOwnTransportCourierKey(intake.selectedCourierKey);
  if (charge.chargeKind === "freight") return true;
  if (charge.chargeKind === "broker") return wantsBroker;
  if (charge.chargeKind === "courier") return wantsCourier;
  return false;
}

/** Published charges that match the customer's confirmed clearance and transportation. */
export function unpaidPublishedChargesForIntake(
  charges: BarrelOutboundShippingChargeView[],
  intake: {
    deliveryMethod: BarrelShippingDeliveryMethod;
    selectedCourierKey?: string | null;
  },
): BarrelOutboundShippingChargeView[] {
  return unpaidPublishedCharges(charges).filter((charge) =>
    chargeMatchesIntakeSelection(charge, intake),
  );
}

/** Hide broker or courier vendor cards the customer opted out of. */
export function vendorChargesForIntake(
  charges: BarrelOutboundShippingChargeView[],
  intake: {
    deliveryMethod: BarrelShippingDeliveryMethod;
    selectedCourierKey?: string | null;
  },
): BarrelOutboundShippingChargeView[] {
  return charges.filter((charge) => chargeMatchesIntakeSelection(charge, intake));
}

/** Customer can switch to self-clearance while the broker charge is unpaid. */
export function canDeclineBrokerForIntake(intake: {
  deliveryMethod: BarrelShippingDeliveryMethod;
  outboundCharges: Pick<
    BarrelOutboundShippingChargeView,
    "chargeKind" | "paidAt"
  >[];
}): boolean {
  if (intake.deliveryMethod !== "broker_delivery") return false;
  const broker = intake.outboundCharges.find(
    (charge) => charge.chargeKind === "broker",
  );
  return !broker?.paidAt;
}

/** Customer can switch to own transportation while the courier charge is unpaid. */
export function canDeclineCourierForIntake(intake: {
  selectedCourierKey?: string | null;
  outboundCharges: Pick<
    BarrelOutboundShippingChargeView,
    "chargeKind" | "paidAt"
  >[];
}): boolean {
  if (!intake.selectedCourierKey?.trim()) return false;
  if (isOwnTransportCourierKey(intake.selectedCourierKey)) return false;
  const courier = intake.outboundCharges.find(
    (charge) => charge.chargeKind === "courier",
  );
  return !courier?.paidAt;
}

export function matchesChargeDestinationCountry(
  partnerCountry: string | null | undefined,
  destinationCountry: string | null | undefined,
): boolean {
  const partner = partnerCountry?.trim().toLowerCase();
  const destination = destinationCountry?.trim().toLowerCase();
  if (!partner || !destination) return false;
  return partner === destination;
}

export function unpaidPublishedChargesForDestination(
  charges: BarrelOutboundShippingChargeView[],
  destinationCountry: string | null | undefined,
  kind?: BarrelOutboundShippingChargeKind,
): BarrelOutboundShippingChargeView[] {
  return publishedChargesForDestination(charges, destinationCountry, kind).filter(
    (charge) => !charge.paidAt && charge.totalCents > 0,
  );
}

export function publishedChargesForDestination(
  charges: BarrelOutboundShippingChargeView[],
  destinationCountry: string | null | undefined,
  kind?: BarrelOutboundShippingChargeKind,
): BarrelOutboundShippingChargeView[] {
  return charges.filter((charge) => {
    if (kind && charge.chargeKind !== kind) return false;
    if (charge.chargeKind === "freight") return true;
    return matchesChargeDestinationCountry(
      charge.partnerCountry,
      destinationCountry,
    );
  });
}

export function paidOutboundCharges(
  charges: BarrelOutboundShippingChargeView[],
): BarrelOutboundShippingChargeView[] {
  return charges.filter((c) => c.paidAt);
}

export function sumOutboundChargesCents(
  charges: Pick<BarrelOutboundShippingChargeView, "totalCents">[],
): number {
  return charges.reduce((s, c) => s + Math.max(0, c.totalCents), 0);
}

export type OutboundShippingPartnerRecord = {
  id: string;
  barrelId: string;
  chargeKind: BarrelOutboundShippingChargeKind;
  name: string;
  location: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  cashappId: string | null;
  cashappAccount: string | null;
  zelleId: string | null;
  zelleAccount: string | null;
  isPrimary: boolean;
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
  selectedBrokerKey: string | null;
  selectedCourierKey: string | null;
  submittedAt: string;
  charges: BarrelOutboundShippingChargeView[];
  partners: OutboundShippingPartnerRecord[];
  chargeId: string | null;
  adminNote: string | null;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  paidAt: string | null;
  paymentReferenceNumber: string | null;
  shipmentTracking: BarrelOutboundShipmentTrackingView | null;
  /** Customer destination address, pre-formatted into tidy display lines. */
  destinationLines: string[];
  /** Staff who last published or edited the shipping charge. */
  updatedByClerkUserId: string | null;
};

export function sumChargeLineCents(
  lines: Pick<OutboundShippingChargeLineView, "amountCents">[],
): number {
  return lines.reduce((s, l) => s + Math.max(0, l.amountCents), 0);
}

export function chargeViewForKind(
  charges: BarrelOutboundShippingChargeView[],
  kind: BarrelOutboundShippingChargeKind,
): BarrelOutboundShippingChargeView | null {
  return charges.find((c) => c.chargeKind === kind) ?? null;
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
    selectedBrokerKey: "jm-kingston-broker",
    selectedCourierKey: "jm-knutsford-cargo",
    submittedAt: new Date().toISOString(),
    charges: [],
    partners: [],
    chargeId: null,
    adminNote: null,
    lines: [],
    totalCents: 0,
    paidAt: null,
    paymentReferenceNumber: null,
    shipmentTracking: null,
    destinationLines: [],
    updatedByClerkUserId: null,
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
