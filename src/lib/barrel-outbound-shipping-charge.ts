import type { BarrelStatus } from "@/lib/barrel-container-types";
import type { BarrelOutboundShipmentTrackingView } from "@/lib/barrel-shipment-tracking";
import type { BarrelShippingDeliveryMethod } from "@/lib/validations/barrel-shipping-intake";
import {
  containerOfferingKindLabel,
  type ContainerOfferingKind,
} from "@/lib/validations/container-offering";

export { ADMIN_OUTBOUND_SHIPPING_CHARGE_LABELS as DEFAULT_OUTBOUND_SHIPPING_CHARGE_LABELS } from "@/lib/outbound-shipping-expected-charges";

export const BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS = [
  "freight",
  "broker",
  "courier",
] as const;

export type BarrelOutboundShippingChargeKind =
  (typeof BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS)[number];

export const OUTBOUND_SHIPPING_COMPANY_RATE_TABLE_KINDS = [
  "container",
  "zone",
] as const;

export type OutboundShippingCompanyRateTableKind =
  (typeof OUTBOUND_SHIPPING_COMPANY_RATE_TABLE_KINDS)[number];

export function isOutboundShippingCompanyRateTableKind(
  value: string | null | undefined,
): value is OutboundShippingCompanyRateTableKind {
  return value === "container" || value === "zone";
}

export function outboundShippingCompanyKey(name: string): string {
  return name.trim().toLowerCase();
}

export function outboundShippingRateRowKey(label: string): string {
  return label.trim().toLowerCase();
}

export function outboundShippingRateTableKindForChargeKind(
  kind: BarrelOutboundShippingChargeKind,
): OutboundShippingCompanyRateTableKind {
  return kind === "courier" ? "zone" : "container";
}

export function outboundShippingRateTableKindsForTabs(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): OutboundShippingCompanyRateTableKind[] {
  const tables: OutboundShippingCompanyRateTableKind[] = [];
  if (kinds.some((kind) => kind === "freight" || kind === "broker")) {
    tables.push("container");
  }
  if (kinds.some((kind) => kind === "courier")) {
    tables.push("zone");
  }
  return tables;
}

export type OutboundShippingCompanyRateRow = {
  id: string;
  companyName: string;
  companyKey: string;
  tableKind: OutboundShippingCompanyRateTableKind;
  rowLabel: string;
  costOneCents: number;
  costTwoPlusCents: number;
  sortIndex: number;
};

export function primaryPartnerNameForKind(
  partners: readonly OutboundShippingPartnerRecord[],
  barrelId: string,
  chargeKind: BarrelOutboundShippingChargeKind,
): string | null {
  const local = partners.filter(
    (partner) =>
      partner.chargeKind === chargeKind && partner.barrelId === barrelId,
  );
  const primary = local.find((partner) => partner.isPrimary) ?? local[0];
  const name = primary?.name.trim();
  return name ? name : null;
}

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
  /** Kinds billed together on this container (empty when tabs stay separate). */
  chargeBundle: BarrelOutboundShippingChargeKind[];
  /** Kinds billed from the company rate card instead of form amounts. */
  companyRateKinds: BarrelOutboundShippingChargeKind[];
};

export function isBarrelOutboundShippingChargeKind(
  value: string | null | undefined,
): value is BarrelOutboundShippingChargeKind {
  return (
    value === "freight" || value === "broker" || value === "courier"
  );
}

export function parseOutboundChargeBundle(
  raw: string | null | undefined,
): BarrelOutboundShippingChargeKind[] {
  const found = new Set(
    (raw ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(isBarrelOutboundShippingChargeKind),
  );
  const kinds = BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) =>
    found.has(kind),
  );
  return kinds.length >= 2 ? [...kinds] : [];
}

export function parseOutboundCompanyRateKinds(
  raw: string | null | undefined,
): BarrelOutboundShippingChargeKind[] {
  const found = new Set(
    (raw ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(isBarrelOutboundShippingChargeKind),
  );
  return BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) => found.has(kind));
}

export function serializeOutboundCompanyRateKinds(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): string | null {
  const found = new Set(kinds.filter(isBarrelOutboundShippingChargeKind));
  const unique = BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) =>
    found.has(kind),
  );
  return unique.length > 0 ? unique.join(",") : null;
}

export function chargeKindUsesCompanyRates(
  kind: BarrelOutboundShippingChargeKind,
  companyRateKinds: readonly BarrelOutboundShippingChargeKind[],
  bundle: readonly BarrelOutboundShippingChargeKind[] = [],
): boolean {
  if (companyRateKinds.includes(kind)) return true;
  const host = outboundChargeBundleHost(bundle);
  return Boolean(
    host &&
      companyRateKinds.includes(host) &&
      bundle.includes(kind),
  );
}

export function serializeOutboundChargeBundle(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): string | null {
  const found = new Set(kinds.filter(isBarrelOutboundShippingChargeKind));
  const unique = BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) =>
    found.has(kind),
  );
  return unique.length >= 2 ? unique.join(",") : null;
}

export function outboundChargeBundleHost(
  bundle: readonly BarrelOutboundShippingChargeKind[],
): BarrelOutboundShippingChargeKind | null {
  if (bundle.length < 2) return null;
  if (bundle.includes("freight")) return "freight";
  if (bundle.includes("broker")) return "broker";
  return "courier";
}

export function outboundChargeBundleLabel(
  bundle: readonly BarrelOutboundShippingChargeKind[],
): string {
  return bundle
    .map((kind) => BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind])
    .join(" + ");
}

const BUNDLE_SHORT_NAMES: Record<BarrelOutboundShippingChargeKind, string> = {
  freight: "freight",
  broker: "broker",
  courier: "local courier",
};

function joinBundleNames(bundle: readonly BarrelOutboundShippingChargeKind[]): string {
  const parts = bundle.map((kind) => BUNDLE_SHORT_NAMES[kind]);
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  if (parts.length === 3) {
    return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
  }
  return parts.join(", ");
}

/** Title for the merged admin form when freight and broker share one company. */
export function outboundChargeBundleSameCompanyTitle(
  bundle: readonly BarrelOutboundShippingChargeKind[],
): string {
  if (bundle.length < 2) return outboundChargeBundleLabel(bundle);
  const joined = joinBundleNames(bundle);
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} — same company information`;
}

export function outboundChargeBundlePdfHeading(
  bundle: readonly BarrelOutboundShippingChargeKind[],
): string {
  if (bundle.length < 2) {
    return BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[bundle[0] ?? "freight"];
  }
  return bundle
    .map((kind) =>
      kind === "freight" ? "Freight" : kind === "broker" ? "Broker" : "Local courier",
    )
    .join(" + ");
}

export function isOutboundChargeKindAbsorbed(
  kind: BarrelOutboundShippingChargeKind,
  bundle: readonly BarrelOutboundShippingChargeKind[],
): boolean {
  const host = outboundChargeBundleHost(bundle);
  return Boolean(host && bundle.includes(kind) && kind !== host);
}

export function resolveCompanyRateLine(input: {
  rates: readonly OutboundShippingCompanyRateRow[];
  companyName: string | null | undefined;
  tableKind: OutboundShippingCompanyRateTableKind;
  rowHint: string | null | undefined;
  containerCount: number;
}): OutboundShippingChargeLineView | null {
  const companyKey = outboundShippingCompanyKey(input.companyName ?? "");
  if (!companyKey) return null;
  const rows = input.rates.filter(
    (row) => row.companyKey === companyKey && row.tableKind === input.tableKind,
  );
  if (rows.length === 0) return null;
  const hint = (input.rowHint ?? "").trim().toLowerCase();
  const match =
    rows.find((row) => row.rowLabel.trim().toLowerCase() === hint) ??
    rows.find((row) => {
      const label = row.rowLabel.trim().toLowerCase();
      return Boolean(hint) && (label.includes(hint) || hint.includes(label));
    }) ??
    (rows.length === 1 ? rows[0] : null);
  if (!match) return null;
  return {
    label: match.rowLabel,
    amountCents:
      input.containerCount >= 2 ? match.costTwoPlusCents : match.costOneCents,
  };
}

export function containerTypeRateHint(kind: ContainerOfferingKind): string {
  return containerOfferingKindLabel(kind);
}

export function applyOutboundChargeBundleForCustomer(
  charges: BarrelOutboundShippingChargeView[],
): BarrelOutboundShippingChargeView[] {
  const bundle = charges[0]?.chargeBundle ?? [];
  const host = outboundChargeBundleHost(bundle);
  if (!host) {
    return charges;
  }
  const companyRateKinds = charges[0]?.companyRateKinds ?? [];
  const hostUsesCompanyRates = chargeKindUsesCompanyRates(
    host,
    companyRateKinds,
    bundle,
  );
  const extras = charges.filter((charge) => {
    if (!isOutboundChargeKindAbsorbed(charge.chargeKind, bundle)) return false;
    if (hostUsesCompanyRates) return false;
    if (companyRateKinds.includes(charge.chargeKind)) return false;
    return true;
  });
  const extraLines = extras.flatMap((charge) =>
    charge.lines.map((line) => ({
      label:
        line.label.trim() ||
        BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_DEFAULT_LABELS[charge.chargeKind],
      amountCents: line.amountCents,
    })),
  );
  return charges
    .filter((charge) => !isOutboundChargeKindAbsorbed(charge.chargeKind, bundle))
    .map((charge) => {
      if (charge.chargeKind !== host || extraLines.length === 0) {
        return charge;
      }
      const lines = [...charge.lines, ...extraLines];
      return {
        ...charge,
        lines,
        totalCents: sumChargeLineCents(lines),
      };
    });
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
  return unpaidPublishedCharges(
    applyOutboundChargeBundleForCustomer(charges),
  ).filter((charge) => chargeMatchesIntakeSelection(charge, intake));
}

/** Hide broker or courier vendor cards the customer opted out of. */
export function vendorChargesForIntake(
  charges: BarrelOutboundShippingChargeView[],
  intake: {
    deliveryMethod: BarrelShippingDeliveryMethod;
    selectedCourierKey?: string | null;
  },
): BarrelOutboundShippingChargeView[] {
  const visible = applyOutboundChargeBundleForCustomer(charges);
  return visible.filter((charge) => chargeMatchesIntakeSelection(charge, intake));
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
  /** Kinds billed as one quote on this container. */
  chargeBundle: BarrelOutboundShippingChargeKind[];
  /** Company rate cards shared across this customer's containers. */
  companyRates: OutboundShippingCompanyRateRow[];
  /** Kinds billed from the company rate card on this container. */
  companyRateKinds: BarrelOutboundShippingChargeKind[];
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
    chargeBundle: [],
    companyRates: [],
    companyRateKinds: [],
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
