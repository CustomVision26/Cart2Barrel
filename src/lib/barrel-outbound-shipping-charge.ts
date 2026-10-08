import type { BarrelStatus } from "@/lib/barrel-container-types";
import type { BarrelOutboundShipmentTrackingView } from "@/lib/barrel-shipment-tracking";
import { isOwnTransportCourierKey } from "@/lib/destination-clearance-partners";
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
  "transport",
  "zone",
] as const;

export type OutboundShippingCompanyRateTableKind =
  (typeof OUTBOUND_SHIPPING_COMPANY_RATE_TABLE_KINDS)[number];

export function isOutboundShippingCompanyRateTableKind(
  value: string | null | undefined,
): value is OutboundShippingCompanyRateTableKind {
  return (
    value === "container" || value === "transport" || value === "zone"
  );
}

export function outboundShippingCompanyKey(name: string): string {
  return name.trim().toLowerCase();
}

export function outboundShippingCountryKey(
  country: string | null | undefined,
): string {
  return country?.trim().toLowerCase() ?? "";
}

/** One catalog record: same company name may exist once per destination country. */
export function outboundShippingPartnerOfferingKey(
  name: string,
  country?: string | null,
): string {
  const company = outboundShippingCompanyKey(name);
  const dest = outboundShippingCountryKey(country);
  return dest ? `${company}::${dest}` : company;
}

export function outboundShippingRateRowKey(
  label: string,
  destination?: string | null,
): string {
  const base = label.trim().toLowerCase();
  const dest = destination?.trim().toLowerCase();
  return dest ? `${base}::${dest}` : base;
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
  destination: string | null;
  costOneCents: number;
  costTwoPlusCents: number;
  sortIndex: number;
};

export function primaryPartnerNameForKind(
  partners: readonly OutboundShippingPartnerRecord[],
  barrelId: string,
  chargeKind: BarrelOutboundShippingChargeKind,
): string | null {
  const ofKind = partners.filter((partner) => partner.chargeKind === chargeKind);
  if (ofKind.length === 0) return null;
  if (isAdminShippingCatalogPreviewBarrelId(barrelId)) {
    const catalog = ofKind.filter((partner) => partner.barrelId == null);
    const pool = catalog.length > 0 ? catalog : ofKind;
    const primary = pool.find((partner) => partner.isPrimary) ?? pool[0];
    const name = primary?.name.trim();
    return name ? name : null;
  }
  const local = ofKind.filter((partner) => partner.barrelId === barrelId);
  const catalog = ofKind.filter((partner) => partner.barrelId == null);
  const pool = local.length > 0 ? local : catalog;
  const primary = pool.find((partner) => partner.isPrimary) ?? pool[0];
  const name = primary?.name.trim();
  return name ? name : null;
}

export function companyCustomerNoteFromPartners(
  partners: readonly OutboundShippingPartnerRecord[],
  companyName: string | null | undefined,
): string | null {
  const companyKey = outboundShippingCompanyKey(companyName ?? "");
  if (!companyKey) return null;
  const match = partners.find(
    (partner) =>
      outboundShippingCompanyKey(partner.name) === companyKey &&
      Boolean(partner.customerNote?.trim()),
  );
  return match?.customerNote?.trim() || null;
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
export const FREIGHT_TRANSPORTATION_FEE_LABEL = "Pickup fee";

export type OutboundShippingChargeLineView = {
  label: string;
  amountCents: number;
};

export function isTransportationFeeLabel(label: string): boolean {
  const trimmed = label.trim();
  return /transportation/i.test(trimmed) || /^pickup fee$/i.test(trimmed);
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

export const OUTBOUND_SHIPPING_REFUND_PATHS = [
  "company_contact",
  "amani",
] as const;

export type OutboundShippingRefundPath =
  (typeof OUTBOUND_SHIPPING_REFUND_PATHS)[number];

export const OUTBOUND_SHIPPING_REFUND_STATUSES = ["pending", "completed"] as const;

export type OutboundShippingRefundStatus =
  (typeof OUTBOUND_SHIPPING_REFUND_STATUSES)[number];

export type OutboundShippingRefundRequestView = {
  id: string;
  status: OutboundShippingRefundStatus;
  refundPath: OutboundShippingRefundPath;
};

export function isOutboundShippingRefundPath(
  value: string | null | undefined,
): value is OutboundShippingRefundPath {
  return value === "company_contact" || value === "amani";
}

export function isOutboundShippingRefundStatus(
  value: string | null | undefined,
): value is OutboundShippingRefundStatus {
  return value === "pending" || value === "completed";
}

export function isOutboundChargeConsolidatedWithFreight(
  charge: Pick<BarrelOutboundShippingChargeView, "chargeKind" | "chargeBundle">,
): boolean {
  return (
    charge.chargeBundle.includes("freight") &&
    charge.chargeBundle.includes(charge.chargeKind) &&
    charge.chargeBundle.length >= 2
  );
}

export function partnerAcceptsZelleOrCashapp(
  charge: Pick<
    BarrelOutboundShippingChargeView,
    | "offPlatformPaymentMethod"
    | "partnerZelleId"
    | "partnerZelleAccount"
    | "partnerCashappId"
    | "partnerCashappAccount"
  >,
): boolean {
  if (
    charge.offPlatformPaymentMethod === "zelle" ||
    charge.offPlatformPaymentMethod === "cashapp"
  ) {
    return true;
  }
  return Boolean(
    charge.partnerZelleId?.trim() ||
      charge.partnerZelleAccount?.trim() ||
      charge.partnerCashappId?.trim() ||
      charge.partnerCashappAccount?.trim(),
  );
}

/** Who issues the refund: the Zelle/Cash App company, or Amani Cart2Barrel (Stripe freight). */
export function outboundShippingRefundPath(
  charge: Pick<
    BarrelOutboundShippingChargeView,
    | "paidAt"
    | "chargeKind"
    | "chargeBundle"
    | "offPlatformPaymentMethod"
    | "partnerZelleId"
    | "partnerZelleAccount"
    | "partnerCashappId"
    | "partnerCashappAccount"
  >,
): OutboundShippingRefundPath | null {
  if (!charge.paidAt) return null;
  if (
    charge.chargeKind === "freight" ||
    isOutboundChargeConsolidatedWithFreight(charge)
  ) {
    return "amani";
  }
  if (
    isOffPlatformOutboundChargeKind(charge.chargeKind) &&
    partnerAcceptsZelleOrCashapp(charge)
  ) {
    return "company_contact";
  }
  return null;
}

export function courierChargeBlocksOwnTransport(
  charges: Pick<
    BarrelOutboundShippingChargeView,
    "chargeKind" | "paidAt" | "refundRequest"
  >[],
): boolean {
  return charges.some(
    (charge) =>
      charge.chargeKind === "courier" &&
      Boolean(charge.paidAt) &&
      charge.refundRequest?.status !== "completed",
  );
}

export function outboundPartnerContactLines(
  charge: Pick<
    BarrelOutboundShippingChargeView,
    | "partnerName"
    | "partnerLocation"
    | "partnerAddress"
    | "partnerCountry"
    | "partnerPhone"
    | "partnerZelleId"
    | "partnerZelleAccount"
    | "partnerCashappId"
    | "partnerCashappAccount"
  >,
): string[] {
  const lines: string[] = [];
  const name = charge.partnerName?.trim();
  if (name) lines.push(name);
  const location = charge.partnerLocation?.trim();
  if (location) lines.push(location);
  const address = charge.partnerAddress?.trim();
  if (address) lines.push(address);
  const country = charge.partnerCountry?.trim();
  if (country) lines.push(country);
  const phone = charge.partnerPhone?.trim();
  if (phone) lines.push(`Tel ${phone}`);
  const zelle = [charge.partnerZelleId, charge.partnerZelleAccount]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");
  if (zelle) lines.push(`Zelle ${zelle}`);
  const cashapp = [charge.partnerCashappId, charge.partnerCashappAccount]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");
  if (cashapp) lines.push(`Cash App ${cashapp}`);
  return lines;
}

export function toIsoTimestamp(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return null;
}

export function isOffPlatformPaymentPendingReview(
  charge: Pick<
    BarrelOutboundShippingChargeView,
    "paidAt" | "offPlatformSubmittedAt"
  > &
    Partial<Pick<BarrelOutboundShippingChargeView, "offPlatformReceiptUrl">>,
): boolean {
  if (charge.paidAt) return false;
  return (
    Boolean(charge.offPlatformSubmittedAt) ||
    Boolean(charge.offPlatformReceiptUrl?.trim())
  );
}

export function chargesPendingOffPlatformReview(
  charges: readonly BarrelOutboundShippingChargeView[],
): BarrelOutboundShippingChargeView[] {
  return charges.filter(isOffPlatformPaymentPendingReview);
}

/**
 * Copy a submitted Zelle / Cash App / local-office receipt onto every unpaid
 * sibling that shares the same company rate link so each container card shows
 * the awaiting-verification state.
 */
export function inheritLinkedOffPlatformPayment(
  chargesByBarrel: Map<string, BarrelOutboundShippingChargeView[]>,
): void {
  const all = [...chargesByBarrel.values()].flat();
  for (const kind of ["broker", "courier"] as const) {
    const ofKind = all.filter(
      (charge) => charge.chargeKind === kind && !charge.paidAt,
    );
    const assigned = new Set<string>();
    for (const charge of ofKind) {
      if (assigned.has(charge.chargeId)) continue;
      const linkedIds = new Set<string>();
      if (charge.barrelId) linkedIds.add(charge.barrelId);
      for (const item of charge.linkedContainers ?? []) {
        if (item.barrelId) linkedIds.add(item.barrelId);
      }
      const group = ofKind.filter((other) => {
        if (other.barrelId && linkedIds.has(other.barrelId)) return true;
        return (other.linkedContainers ?? []).some(
          (item) => item.barrelId && linkedIds.has(item.barrelId),
        );
      });
      for (const item of group) assigned.add(item.chargeId);
      const source = group.find(
        (item) =>
          item.offPlatformSubmittedAt || item.offPlatformReceiptUrl,
      );
      const richestLinks = group.reduce((best, item) =>
        (item.linkedContainers?.length ?? 0) >
        (best.linkedContainers?.length ?? 0)
          ? item
          : best,
      );
      for (const item of group) {
        if (
          (item.linkedContainers?.length ?? 0) <
          (richestLinks.linkedContainers?.length ?? 0)
        ) {
          item.linkedContainers = richestLinks.linkedContainers;
        }
        if (!source || item.offPlatformSubmittedAt) continue;
        item.offPlatformPaymentMethod = source.offPlatformPaymentMethod;
        item.offPlatformPayerName = source.offPlatformPayerName;
        item.offPlatformReceiptUrl = source.offPlatformReceiptUrl;
        item.offPlatformSubmittedAt = toIsoTimestamp(
          source.offPlatformSubmittedAt,
        );
      }
    }
  }
}

/** Continue to pricing stays disabled until unpaid freight is in the cart. */
export function unpaidFreightReadyForPricingContinue(
  members: readonly {
    outboundCharges: readonly BarrelOutboundShippingChargeView[];
  }[],
): boolean {
  const freight = members.flatMap((row) =>
    applyOutboundChargeBundleForCustomer([...row.outboundCharges]).filter(
      (charge) =>
        charge.chargeKind === "freight" &&
        !charge.paidAt &&
        charge.totalCents > 0,
    ),
  );
  if (freight.length === 0) return true;
  return freight.some((charge) => charge.inCart);
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
  barrelId?: string;
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
  partnerImageUrl: string | null;
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
  /** Other unpaid containers billed with this company rate (includes this barrel). */
  linkedContainers: { barrelId: string; alias: string }[];
  refundRequest: OutboundShippingRefundRequestView | null;
};

/** Card that shows Add to cart / pay for a linked group; others only reference it. */
export function jointChargePayHost(
  linked: readonly { barrelId: string; alias: string }[] | null | undefined,
  preferBarrelIds?: readonly string[] | null,
): { barrelId: string; alias: string } | null {
  if (!linked || linked.length < 2) return null;
  const prefer = new Set(
    (preferBarrelIds ?? []).filter((id) => id.trim().length > 0),
  );
  const preferred =
    prefer.size > 0 ? linked.filter((item) => prefer.has(item.barrelId)) : [];
  const pool = preferred.length > 0 ? preferred : linked;
  return (
    [...pool].sort((a, b) =>
      a.alias.localeCompare(b.alias, undefined, { numeric: true }),
    )[0] ?? null
  );
}

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

/** Kind label on customer surfaces; includes the consolidate list on the host charge. */
export function outboundChargeKindDisplayLabel(
  charge: Pick<BarrelOutboundShippingChargeView, "chargeKind" | "chargeBundle">,
): string {
  const bundle = charge.chargeBundle ?? [];
  if (
    bundle.length >= 2 &&
    outboundChargeBundleHost(bundle) === charge.chargeKind
  ) {
    return outboundChargeBundleLabel(bundle);
  }
  return BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind];
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

/** Freight links also cover absorbed broker/courier so the bundled rate table applies. */
export function customerCompanyLinkKinds(input: {
  kind: BarrelOutboundShippingChargeKind;
  bundle: readonly BarrelOutboundShippingChargeKind[];
}): BarrelOutboundShippingChargeKind[] {
  if (input.kind !== "freight") return [input.kind];
  const extra = input.bundle.filter((kind) =>
    isOutboundChargeKindAbsorbed(kind, input.bundle),
  );
  return ["freight", ...extra];
}

export function normalizePlaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/\bst\./g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parish, city, then any extra location — used to pick a local-courier zone rate. */
export function destinationCourierZoneHints(input: {
  parish?: string | null;
  cityOrTown?: string | null;
  extra?: string | null;
}): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();
  const parts = [input.parish, input.cityOrTown, input.extra];
  if (input.cityOrTown?.includes(",")) {
    parts.push(...input.cityOrTown.split(","));
  }
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    const key = normalizePlaceName(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    hints.push(trimmed);
  }
  return hints;
}

function zoneRowMatchesHint(
  rowLabel: string,
  hint: string,
  mode: "exact" | "contains",
): boolean {
  const zone = normalizePlaceName(rowLabel);
  const dest = normalizePlaceName(hint);
  if (!zone || !dest) return false;
  if (mode === "exact") return zone === dest;
  return zone.includes(dest) || dest.includes(zone);
}

/** Match a local-courier zone by destination parish/city name. No single-row fallback. */
export function matchCourierZoneRateRow(
  rows: readonly OutboundShippingCompanyRateRow[],
  hints: readonly string[],
): OutboundShippingCompanyRateRow | null {
  const cleaned = hints.map((part) => part.trim()).filter(Boolean);
  return (
    cleaned
      .map((hint) =>
        rows.find((row) => zoneRowMatchesHint(row.rowLabel, hint, "exact")),
      )
      .find((row): row is OutboundShippingCompanyRateRow => Boolean(row)) ??
    cleaned
      .map((hint) =>
        rows.find((row) => zoneRowMatchesHint(row.rowLabel, hint, "contains")),
      )
      .find((row): row is OutboundShippingCompanyRateRow => Boolean(row)) ??
    null
  );
}

export function resolveCompanyRateLine(input: {
  rates: readonly OutboundShippingCompanyRateRow[];
  companyName: string | null | undefined;
  tableKind: OutboundShippingCompanyRateTableKind;
  rowHint: string | null | undefined;
  destinationHints?: readonly string[];
  containerCount: number;
}): OutboundShippingChargeLineView | null {
  const companyKey = outboundShippingCompanyKey(input.companyName ?? "");
  if (!companyKey) return null;
  const rows = input.rates.filter(
    (row) => row.companyKey === companyKey && row.tableKind === input.tableKind,
  );
  if (rows.length === 0) return null;

  const hints = [
    ...(input.destinationHints ?? []),
    input.rowHint ?? "",
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  let match: OutboundShippingCompanyRateRow | undefined;
  if (input.tableKind === "zone") {
    match = matchCourierZoneRateRow(rows, hints) ?? undefined;
  } else {
    const destHints = (input.destinationHints ?? [])
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const destMatches = destHints.length
      ? rows.filter((row) => {
          const dest = row.destination?.trim().toLowerCase();
          if (!dest) return false;
          return destHints.some(
            (hint) => dest === hint || dest.includes(hint) || hint.includes(dest),
          );
        })
      : [];
    const unlabeled = rows.filter((row) => !row.destination?.trim());
    const pool =
      destMatches.length > 0 ? destMatches
      : unlabeled.length > 0 ? unlabeled
      : rows;
    const hint = (input.rowHint ?? "").trim().toLowerCase();
    match =
      pool.find((row) => row.rowLabel.trim().toLowerCase() === hint) ??
      pool.find((row) => {
        const label = row.rowLabel.trim().toLowerCase();
        return Boolean(hint) && (label.includes(hint) || hint.includes(label));
      });
  }
  if (!match && input.tableKind !== "zone" && rows.length === 1) {
    match = rows[0];
  }
  if (!match) return null;
  const amountCents =
    input.tableKind === "transport"
      ? hubTransportFeeAmountCents(
          match.costOneCents,
          match.costTwoPlusCents,
          input.containerCount,
        )
      : companyRateCardAmountCents(
          match.costOneCents,
          match.costTwoPlusCents,
          input.containerCount,
        );
  return {
    label:
      input.tableKind === "transport"
        ? FREIGHT_TRANSPORTATION_FEE_LABEL
        : match.rowLabel,
    amountCents,
  };
}

/** First linked container uses the 1-container rate; each extra adds the 2+ rate. */
export function companyRateCardAmountCents(
  costOneCents: number,
  costTwoPlusCents: number,
  containerCount: number,
): number {
  const count = Math.max(1, Math.trunc(containerCount));
  if (count === 1) return Math.max(0, costOneCents);
  return (
    Math.max(0, costOneCents) + (count - 1) * Math.max(0, costTwoPlusCents)
  );
}

/**
 * Hub → freight office. One container uses the 1-container fee. Two or more
 * containers billed on the same freight quote use the extra-container fee for
 * every container (2 linked barrels = 2 × extra-container fee).
 */
export function hubTransportFeeAmountCents(
  costOneCents: number,
  costTwoPlusCents: number,
  containerCount: number,
): number {
  const count = Math.max(1, Math.trunc(containerCount));
  if (count === 1) return Math.max(0, costOneCents);
  return count * Math.max(0, costTwoPlusCents);
}

export function unpaidLinkedContainerCount(input: {
  barrelId: string;
  companyName: string | null | undefined;
  chargeKind: BarrelOutboundShippingChargeKind;
  companyRateLinks: readonly AdminCompanyRateLinkGroup[];
  linkableContainers: readonly AdminRateLinkableContainer[];
}): number {
  const companyKey = outboundShippingCompanyKey(input.companyName ?? "");
  const group = companyKey
    ? input.companyRateLinks.find(
        (item) =>
          item.companyKey === companyKey &&
          item.chargeKind === input.chargeKind,
      )
    : undefined;
  const ids =
    group && group.barrelIds.includes(input.barrelId)
      ? group.barrelIds
      : [input.barrelId];
  const unpaid = ids.filter((id) => {
    const row = input.linkableContainers.find((item) => item.barrelId === id);
    if (!row) return true;
    return row.unpaidByKind[input.chargeKind] !== false;
  });
  return unpaid.length >= 2 ? unpaid.length : 1;
}

export function companyRateKindsToPrice(input: {
  chargeKind: BarrelOutboundShippingChargeKind;
  bundle: readonly BarrelOutboundShippingChargeKind[];
  companyRateKinds: readonly BarrelOutboundShippingChargeKind[];
}): BarrelOutboundShippingChargeKind[] {
  const host = outboundChargeBundleHost(input.bundle);
  if (host && input.chargeKind === host && input.bundle.length >= 2) {
    const kinds = input.bundle.filter(
      (kind) => kind === host || input.companyRateKinds.includes(kind),
    );
    return kinds.length > 0 ? kinds : [input.chargeKind];
  }
  return [input.chargeKind];
}

export function resolveCompanyRateLinesForKinds(input: {
  rates: readonly OutboundShippingCompanyRateRow[];
  companyName: string | null | undefined;
  kinds: readonly BarrelOutboundShippingChargeKind[];
  containerKind: ContainerOfferingKind;
  destinationHints?: readonly string[];
  containerCount: number;
}): OutboundShippingChargeLineView[] {
  const tableKinds = outboundShippingRateTableKindsForTabs(input.kinds);
  const lines: OutboundShippingChargeLineView[] = [];
  const seen = new Set<string>();
  for (const tableKind of tableKinds) {
    const line = resolveCompanyRateLine({
      rates: input.rates,
      companyName: input.companyName,
      tableKind,
      rowHint:
        tableKind === "container"
          ? containerTypeRateHint(input.containerKind)
          : (input.destinationHints?.[0] ?? null),
      destinationHints: input.destinationHints,
      containerCount: input.containerCount,
    });
    if (!line) continue;
    const key = `${tableKind}:${line.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  if (input.kinds.includes("freight")) {
    const transport = resolveCompanyRateLine({
      rates: input.rates,
      companyName: input.companyName,
      tableKind: "transport",
      rowHint: containerTypeRateHint(input.containerKind),
      containerCount: input.containerCount,
    });
    if (transport && transport.amountCents > 0) {
      const key = `transport:${transport.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(transport);
      }
    }
  }
  return lines;
}

export function containerTypeRateHint(kind: ContainerOfferingKind): string {
  return containerOfferingKindLabel(kind);
}

export function quotedHubTransportFeeCents(input: {
  rates: readonly OutboundShippingCompanyRateRow[];
  companyName: string | null | undefined;
  containerKind: ContainerOfferingKind;
  containerCount: number;
}): number | null {
  const line = resolveCompanyRateLine({
    rates: input.rates,
    companyName: input.companyName,
    tableKind: "transport",
    rowHint: containerTypeRateHint(input.containerKind),
    containerCount: input.containerCount,
  });
  return line ? line.amountCents : null;
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

/** Customer destination UI: hide absorbed kinds; couriers are admin-published only. */
export function destinationClearancePresentation(
  charges: readonly BarrelOutboundShippingChargeView[],
  destinationCountry?: string | null,
) {
  const bundle = charges[0]?.chargeBundle ?? [];
  const brokerAbsorbed = isOutboundChargeKindAbsorbed("broker", bundle);
  const courierAbsorbed = isOutboundChargeKindAbsorbed("courier", bundle);
  const visible = applyOutboundChargeBundleForCustomer([...charges]);
  const publishedBrokers = destinationCountry
    ? publishedChargesForDestination(visible, destinationCountry, "broker")
    : [];
  const publishedCouriers = destinationCountry
    ? publishedChargesForDestination(visible, destinationCountry, "courier")
    : [];
  return {
    bundle,
    brokerAbsorbed,
    courierAbsorbed,
    showBrokerUi: !brokerAbsorbed,
    showSelfClearance: !brokerAbsorbed,
    showCourierUi: !courierAbsorbed,
    publishedBrokers,
    publishedCouriers,
  };
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
  barrelId: string | null;
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
    imageUrl: string | null;
    isPrimary: boolean;
    customerNote: string | null;
    publicPricingPublishedAt: string | null;
};

export type AdminRateLinkableContainer = {
  barrelId: string;
  alias: string;
  slotLabel: string;
  partnerKeyByKind: Partial<
    Record<BarrelOutboundShippingChargeKind, string>
  >;
  unpaidByKind: Partial<Record<BarrelOutboundShippingChargeKind, boolean>>;
  /** Confirmed intake courier choice; awaiting cards have none yet. */
  selectedCourierKey?: string | null;
};

/** Same company, or no company assigned yet for these kinds. */
export function containerCanJoinCompanyRateCard(
  partnerKeyByKind: Partial<Record<BarrelOutboundShippingChargeKind, string>>,
  kinds: readonly BarrelOutboundShippingChargeKind[],
  companyKey: string,
): boolean {
  return kinds.every((kind) => {
    const assigned = partnerKeyByKind[kind];
    return !assigned || assigned === companyKey;
  });
}

/** Courier linking: unpaid containers that already chose own transportation. */
export function containerEligibleForCourierRateLink(
  container: Pick<
    AdminRateLinkableContainer,
    "unpaidByKind" | "selectedCourierKey"
  >,
): boolean {
  if (container.unpaidByKind.courier === false) return false;
  return isOwnTransportCourierKey(container.selectedCourierKey);
}

export function linkableContainersFromChargeRows(
  rows: readonly {
    barrelId: string;
    alias: string;
    slotLabel: string;
    selectedCourierKey?: string | null;
    outboundCharges: readonly Pick<
      BarrelOutboundShippingChargeView,
      "chargeKind" | "partnerName" | "paidAt"
    >[];
  }[],
): AdminRateLinkableContainer[] {
  return rows.map((row) => {
    const partnerKeyByKind: AdminRateLinkableContainer["partnerKeyByKind"] =
      {};
    const unpaidByKind: AdminRateLinkableContainer["unpaidByKind"] = {};
    for (const charge of row.outboundCharges) {
      const key = outboundShippingCompanyKey(charge.partnerName ?? "");
      if (key) partnerKeyByKind[charge.chargeKind] = key;
      unpaidByKind[charge.chargeKind] = !charge.paidAt;
    }
    return {
      barrelId: row.barrelId,
      alias: row.alias,
      slotLabel: row.slotLabel,
      partnerKeyByKind,
      unpaidByKind,
      selectedCourierKey: row.selectedCourierKey ?? null,
    };
  });
}

export type AdminCompanyRateLinkGroup = {
  companyKey: string;
  chargeKind: BarrelOutboundShippingChargeKind;
  barrelIds: string[];
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
  destinationParish: string | null;
  destinationCityOrTown: string | null;
  /** Staff who last published or edited the shipping charge. */
  updatedByClerkUserId: string | null;
  /** Kinds billed as one quote on this container. */
  chargeBundle: BarrelOutboundShippingChargeKind[];
  /** Company rate cards shared across this customer's containers. */
  companyRates: OutboundShippingCompanyRateRow[];
  /** Kinds billed from the company rate card on this container. */
  companyRateKinds: BarrelOutboundShippingChargeKind[];
  /** This customer's containers, for 1 vs 2+ company-rate linking. */
  rateLinkableContainers: AdminRateLinkableContainer[];
  /** Saved unpaid-container links for this customer. */
  companyRateLinks: AdminCompanyRateLinkGroup[];
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

/** Sentinel barrel id on the empty-state shipments form — not a real container. */
export const ADMIN_SHIPPING_CATALOG_PREVIEW_BARREL_ID =
  "00000000-0000-4000-8000-000000000001";

export function isAdminShippingCatalogPreviewBarrelId(
  barrelId: string | null | undefined,
): boolean {
  return !barrelId || barrelId === ADMIN_SHIPPING_CATALOG_PREVIEW_BARREL_ID;
}

export function isAdminShippingCatalogPreview(
  row: Pick<AdminBarrelOutboundShippingChargeRow, "intakeId">,
): boolean {
  return row.intakeId === "preview";
}

/** Shown on `/admin/shipments` when no live containers qualify yet. */
export const ADMIN_SHIPPING_CHARGE_PREVIEW_ROW: AdminBarrelOutboundShippingChargeRow =
  {
    barrelId: ADMIN_SHIPPING_CATALOG_PREVIEW_BARREL_ID,
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
    destinationParish: null,
    destinationCityOrTown: null,
    updatedByClerkUserId: null,
    chargeBundle: [],
    companyRates: [],
    companyRateKinds: [],
    rateLinkableContainers: [],
    companyRateLinks: [],
  };

export function buildAdminShippingCatalogPreviewRow(input: {
  partners: AdminBarrelOutboundShippingChargeRow["partners"];
  companyRates: AdminBarrelOutboundShippingChargeRow["companyRates"];
  chargeBundle: AdminBarrelOutboundShippingChargeRow["chargeBundle"];
  companyRateKinds: AdminBarrelOutboundShippingChargeRow["companyRateKinds"];
}): AdminBarrelOutboundShippingChargeRow {
  return {
    ...ADMIN_SHIPPING_CHARGE_PREVIEW_ROW,
    partners: input.partners,
    companyRates: input.companyRates,
    chargeBundle: input.chargeBundle,
    companyRateKinds: input.companyRateKinds,
  };
}

export type AdminShipmentCustomerGroup = {
  clerkUserId: string;
  customerName: string | null;
  customerEmail: string | null;
  readyContainers: AdminBarrelOutboundShippingChargeRow[];
  notReadyContainers: AdminBarrelOutboundShippingChargeRow[];
};

export type AdminShipmentChargePageData = {
  customerGroups: AdminShipmentCustomerGroup[];
  catalogPartners: OutboundShippingPartnerRecord[];
  companyRates: OutboundShippingCompanyRateRow[];
  catalogChargeBundle: BarrelOutboundShippingChargeKind[];
  catalogCompanyRateKinds: BarrelOutboundShippingChargeKind[];
};
