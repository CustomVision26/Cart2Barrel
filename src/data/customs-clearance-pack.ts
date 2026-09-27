import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelShippingIntakes,
  barrels,
  orderContainerItems,
  profiles,
} from "@/db/schema";
import { getPrimaryShippingAddress } from "@/data/addresses";
import { getBarrelContentsByBarrelIds } from "@/data/barrel-contents";
import { getOutboundShippingChargesByBarrelIds } from "@/data/barrel-outbound-shipping-charges";
import { getShipmentTrackingByBarrelIds } from "@/data/barrel-outbound-shipment-tracking";
import { getPrimaryImageUrlByOfferingIds } from "@/data/container-offerings";
import { loadHubContactSettings } from "@/data/hub-contact-settings";
import { loadHubShipFromSettings } from "@/data/hub-ship-from";
import { getInvoiceCompanyProfile } from "@/lib/invoice/company-profile";
import type { InvoiceCompanyProfile } from "@/lib/invoice/company-profile";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  OFF_PLATFORM_PAYMENT_METHOD_LABELS,
  parseOutboundChargeBundle,
  type BarrelOutboundShippingChargeKind,
  type BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  findDestinationBroker,
  findDestinationCourier,
  OWN_TRANSPORT_COURIER_KEY,
  type DestinationPartner,
} from "@/lib/destination-clearance-partners";
import type {
  CustomsClearancePackPartner,
  CustomsClearancePackPdfPayload,
} from "@/lib/invoice/customs-clearance-pack-types";
import { hasCustomsClearanceInfo } from "@/lib/barrel-shipment-tracking";

async function senderProfile(): Promise<InvoiceCompanyProfile> {
  const invoice = getInvoiceCompanyProfile();
  const [hub, contact] = await Promise.all([
    loadHubShipFromSettings(),
    loadHubContactSettings(),
  ]);
  const name = /llc/i.test(invoice.name)
    ? invoice.name
    : "Amani Cart2Barrel LLC";
  const invoiceHasStreet = invoice.addressLines.some(
    (line) => line.trim() && line.trim().toLowerCase() !== "united states",
  );
  const hubLines = [
    hub.line1.trim() || null,
    hub.line2.trim() || null,
    [hub.city.trim(), hub.state.trim(), hub.postalCode.trim()]
      .filter(Boolean)
      .join(" ") || null,
    hub.country.trim() || null,
  ].filter((line): line is string => Boolean(line));
  return {
    name,
    addressLines:
      invoiceHasStreet && invoice.addressLines.length > 0
        ? invoice.addressLines
        : hubLines.length > 0
          ? hubLines
          : invoice.addressLines,
    phone: invoice.phone || contact.supportPhone || hub.phone.trim() || null,
    email: invoice.email || contact.supportEmail || null,
  };
}

function paymentMethodLabel(
  charge: BarrelOutboundShippingChargeView,
): string | null {
  if (charge.offPlatformPaymentMethod) {
    return OFF_PLATFORM_PAYMENT_METHOD_LABELS[charge.offPlatformPaymentMethod];
  }
  if (charge.paidAt) {
    return "Paid through Amani Cart2Barrel checkout";
  }
  return null;
}

function mapChargePartner(
  charge: BarrelOutboundShippingChargeView,
): CustomsClearancePackPartner {
  return {
    kindLabel: BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind],
    name:
      charge.partnerName?.trim() ||
      BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind],
    location: charge.partnerLocation,
    country: charge.partnerCountry,
    address: charge.partnerAddress,
    phone: charge.partnerPhone,
    cashappId: charge.partnerCashappId,
    cashappAccount: charge.partnerCashappAccount,
    zelleId: charge.partnerZelleId,
    zelleAccount: charge.partnerZelleAccount,
    lines: charge.lines,
    totalCents: charge.totalCents,
    receiptUrl: charge.offPlatformReceiptUrl,
    paymentMethod: paymentMethodLabel(charge),
    paidAt: charge.paidAt,
    notes: charge.adminNote,
  };
}

function mapCatalogPartner(
  kind: BarrelOutboundShippingChargeKind,
  partner: DestinationPartner,
): CustomsClearancePackPartner {
  return {
    kindLabel: BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind],
    name: partner.name,
    location: partner.location,
    country: partner.country === "*" ? null : partner.country,
    address: null,
    phone: null,
    cashappId: null,
    cashappAccount: null,
    zelleId: null,
    zelleAccount: null,
    lines: [],
    totalCents: 0,
    receiptUrl: null,
    paymentMethod: null,
    paidAt: null,
    notes: partner.summary,
  };
}

function mergePartner(
  kind: BarrelOutboundShippingChargeKind,
  charge: BarrelOutboundShippingChargeView | undefined,
  catalog: DestinationPartner | null,
): CustomsClearancePackPartner | null {
  if (charge) {
    const mapped = mapChargePartner(charge);
    if (!mapped.name || mapped.name === BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind]) {
      mapped.name = catalog?.name?.trim() || mapped.name;
    }
    mapped.location = mapped.location || catalog?.location || null;
    mapped.notes = mapped.notes || catalog?.summary || null;
    return mapped;
  }
  if (catalog) {
    return mapCatalogPartner(kind, catalog);
  }
  return null;
}

export async function getCustomsClearancePackPdfPayload(
  barrelId: string,
  options?: {
    clerkUserId?: string;
    requirePublished?: boolean;
  },
): Promise<CustomsClearancePackPdfPayload | null> {
  const db = getDb();
  const ownerFilter = options?.clerkUserId
    ? and(
        eq(barrels.id, barrelId),
        eq(barrels.clerkUserId, options.clerkUserId),
      )
    : eq(barrels.id, barrelId);
  const [row] = await db
    .select({
      barrel: barrels,
      intake: barrelShippingIntakes,
      oci: orderContainerItems,
      profile: profiles,
    })
    .from(barrels)
    .leftJoin(
      barrelShippingIntakes,
      eq(barrelShippingIntakes.barrelId, barrels.id),
    )
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .leftJoin(profiles, eq(barrels.clerkUserId, profiles.clerkUserId))
    .where(ownerFilter!)
    .limit(1);
  if (!row) return null;

  const clerkUserId = row.barrel.clerkUserId;
  const offeringId = row.oci?.containerOfferingId ?? null;
  const [chargesByBarrel, trackingByBarrel, address, sender, contentsByBarrel, offeringImages] =
    await Promise.all([
      getOutboundShippingChargesByBarrelIds(clerkUserId, [barrelId]),
      getShipmentTrackingByBarrelIds([barrelId]),
      getPrimaryShippingAddress(clerkUserId),
      senderProfile(),
      getBarrelContentsByBarrelIds(clerkUserId, [barrelId]),
      offeringId
        ? getPrimaryImageUrlByOfferingIds([offeringId])
        : Promise.resolve(new Map<string, string>()),
    ]);
  const charges = chargesByBarrel.get(barrelId) ?? [];
  const tracking = trackingByBarrel.get(barrelId) ?? null;
  if (
    options?.requirePublished &&
    !hasCustomsClearanceInfo({
      customsDeclarationFormUrl: tracking?.customsDeclarationFormUrl ?? null,
      freightCompanyName: tracking?.freightCompanyName ?? null,
    })
  ) {
    return null;
  }
  const freight = charges.find((charge) => charge.chargeKind === "freight");
  const brokerCharge = charges.find((charge) => charge.chargeKind === "broker");
  const courierCharge = charges.find((charge) => charge.chargeKind === "courier");
  const chargeBundle = parseOutboundChargeBundle(
    row.barrel.outboundChargeBundle,
  );
  const destinationCountry = address?.country?.trim() || null;
  const usesBroker =
    row.intake?.deliveryMethod === "broker_delivery" ||
    chargeBundle.includes("broker");
  const courierKey = row.intake?.selectedCourierKey?.trim() || null;
  const usesCourier =
    chargeBundle.includes("courier") ||
    (Boolean(courierKey) &&
      courierKey !== OWN_TRANSPORT_COURIER_KEY &&
      courierKey !== "self-arrange-local");

  const receiverName =
    address?.recipientName?.trim() ||
    row.profile?.fullName?.trim() ||
    "Destination receiver";
  const receiverStreetLines: string[] = [];
  if (address) {
    const street = [address.line1, address.line2]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(", ");
    if (street) receiverStreetLines.push(street);
    const cityLine = [address.cityOrTown, address.parish, address.postalCode]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(", ");
    if (cityLine) receiverStreetLines.push(cityLine);
    if (address.country?.trim()) receiverStreetLines.push(address.country.trim());
  }
  const containerName =
    row.oci?.nameSnapshot?.trim() || `Container ${row.barrel.id.slice(0, 8)}`;

  const slug = (freight?.partnerName || row.barrel.id.slice(0, 8))
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    filename: `customs-clearance-pack-${slug}.pdf`,
    containerName,
    containerAlias: `Slot ${row.barrel.unitOrdinal}`,
    containerImageUrl: offeringId
      ? offeringImages.get(offeringId) ?? null
      : null,
    contents: contentsByBarrel.get(barrelId) ?? [],
    sender,
    receiver: {
      name: receiverName,
      phone: address?.recipientPhone?.trim() || null,
      email: row.profile?.email?.trim() || null,
      addressLines: receiverStreetLines,
    },
    freight: mergePartner("freight", freight, null),
    broker: usesBroker
      ? mergePartner(
          "broker",
          brokerCharge,
          findDestinationBroker(
            row.intake?.selectedBrokerKey,
            destinationCountry,
          ),
        )
      : null,
    courier: usesCourier
      ? mergePartner(
          "courier",
          courierCharge,
          findDestinationCourier(courierKey, destinationCountry),
        )
      : null,
    chargeBundle,
    tracking: {
      freightCompanyName:
        tracking?.freightCompanyName?.trim() ||
        freight?.partnerName?.trim() ||
        null,
      freightDropOffAt: tracking?.freightDropOffAt ?? null,
      estimatedArrivalAt: tracking?.estimatedArrivalAt ?? null,
      paymentReference: freight?.paymentReferenceNumber ?? null,
      customsFormUrl: tracking?.customsDeclarationFormUrl ?? null,
    },
  };
}
