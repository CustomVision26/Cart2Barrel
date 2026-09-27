import "server-only";

import { and, asc, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import type { StripeCheckoutPriceDataLine } from "@/data/cart";
import { STRIPE_CHECKOUT_LINE_MIN_US_CENTS } from "@/data/cart";
import { formatUsd } from "@/lib/admin-markup";

import { getPrimaryShippingAddress } from "@/data/addresses";
import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrelOutboundShippingPartners,
  barrels,
  orderContainerItems,
  userOutboundShippingCartLines,
} from "@/db/schema";
import {
  addOutboundShippingPartner,
  getPrimaryOutboundShippingPartner,
  syncBundlePartnersFromHost,
} from "@/data/barrel-outbound-shipping-partners";
import { getShipmentTrackingByBarrelIds } from "@/data/barrel-outbound-shipment-tracking";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { ensureBarrelOutboundShipmentTrackingSchema } from "@/data/ensure-barrel-outbound-shipment-tracking-schema";
import { orderContainerItemSnapshotColumns } from "@/data/ensure-order-container-packaging-fee-schema";
import { generateOutboundShippingPaymentReference } from "@/lib/generate-outbound-shipping-payment-reference";
import { upsertShipmentTrackingOnFreightPaid } from "@/data/barrel-outbound-shipment-tracking";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import type {
  BarrelOutboundShippingChargeView,
  OffPlatformPaymentMethod,
  OutboundShippingChargeLineView,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  chargeKindUsesCompanyRates,
  companyRateKindsToPrice,
  destinationCourierZoneHints,
  isAdminShippingCatalogPreviewBarrelId,
  isBarrelOutboundShippingChargeKind,
  isOffPlatformOutboundChargeKind,
  isOffPlatformPaymentMethod,
  isOutboundChargeKindAbsorbed,
  outboundChargeBundleHost,
  outboundShippingCompanyKey,
  parseOutboundChargeBundle,
  parseOutboundCompanyRateKinds,
  resolveCompanyRateLinesForKinds,
  serializeOutboundChargeBundle,
  serializeOutboundCompanyRateKinds,
  sumChargeLineCents,
  type BarrelOutboundShippingChargeKind,
} from "@/lib/barrel-outbound-shipping-charge";
import { listOutboundShippingCompanyRates } from "@/data/outbound-shipping-company-rates";
import {
  expandChargeIdsWithCompanyRateLinks,
  groupCompanyRateLinks,
  linkedBarrelIdsForCompanyKind,
  listOutboundShippingCompanyRateLinksForUser,
  rateCardContainerCount,
} from "@/data/outbound-shipping-company-rate-links";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import { buildContainerAliasMap } from "@/lib/container-slot-alias";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

export type OutboundShippingCartLineView = {
  chargeId: string;
  barrelId: string;
  alias: string;
  slotLabel: string;
  kind: ContainerOfferingKind;
  chargeKind: import("@/lib/barrel-outbound-shipping-charge").BarrelOutboundShippingChargeKind;
  partnerName: string | null;
  partnerAddress: string | null;
  partnerCountry: string | null;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  adminNote: string | null;
};

async function loadChargeViewsForBarrelIds(
  clerkUserId: string,
  barrelIds: string[],
): Promise<Map<string, BarrelOutboundShippingChargeView[]>> {
  if (barrelIds.length === 0) {
    return new Map();
  }

  await ensureBarrelOutboundShippingChargesSchema();
  await ensureBarrelOutboundShipmentTrackingSchema();
  const db = getDb();

  const charges = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.barrelId, barrelIds),
      ),
    );

  if (charges.length === 0) {
    return new Map();
  }

  const chargeIds = charges.map((c) => c.id);
  const lineRows = await db
    .select()
    .from(barrelOutboundShippingChargeLines)
    .where(inArray(barrelOutboundShippingChargeLines.chargeId, chargeIds))
    .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));

  const linesByCharge = new Map<string, OutboundShippingChargeLineView[]>();
  for (const line of lineRows) {
    const list = linesByCharge.get(line.chargeId) ?? [];
    list.push({ label: line.label, amountCents: line.amountCents });
    linesByCharge.set(line.chargeId, list);
  }

  const cartRows = await db
    .select({ chargeId: userOutboundShippingCartLines.chargeId })
    .from(userOutboundShippingCartLines)
    .where(eq(userOutboundShippingCartLines.clerkUserId, clerkUserId));
  const inCartIds = new Set(cartRows.map((r) => r.chargeId));
  const trackingByBarrel = await getShipmentTrackingByBarrelIds(
    charges.map((c) => c.barrelId),
  );
  const bundleRows = await db
    .select({
      id: barrels.id,
      clerkUserId: barrels.clerkUserId,
      outboundChargeBundle: barrels.outboundChargeBundle,
      outboundCompanyRateKinds: barrels.outboundCompanyRateKinds,
      kindSnapshot: orderContainerItems.kindSnapshot,
      createdAt: barrels.createdAt,
    })
    .from(barrels)
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .where(inArray(barrels.id, barrelIds));
  const bundleByBarrel = new Map(
    bundleRows.map((row) => [
      row.id,
      parseOutboundChargeBundle(row.outboundChargeBundle),
    ]),
  );
  const companyRateKindsByBarrel = new Map(
    bundleRows.map((row) => [
      row.id,
      parseOutboundCompanyRateKinds(row.outboundCompanyRateKinds),
    ]),
  );
  const containerKindByBarrel = new Map(
    bundleRows.map((row) => [
      row.id,
      parseContainerOfferingKind(row.kindSnapshot ?? "barrel"),
    ]),
  );
  const userActiveBarrels = await db
    .select({
      id: barrels.id,
      kindSnapshot: orderContainerItems.kindSnapshot,
      createdAt: barrels.createdAt,
    })
    .from(barrels)
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .where(
      and(
        eq(barrels.clerkUserId, clerkUserId),
        notInArray(barrels.status, ["shipped", "delivered"]),
      ),
    );
  const aliasMap = buildContainerAliasMap(
    userActiveBarrels.map((row) => ({
      barrelId: row.id,
      kind: parseContainerOfferingKind(row.kindSnapshot ?? "barrel"),
      createdAt: row.createdAt,
    })),
  );
  const linkGroups = groupCompanyRateLinks(
    await listOutboundShippingCompanyRateLinksForUser(clerkUserId),
  );
  const allUserCharges = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      barrelId: barrelOutboundShippingCharges.barrelId,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId));
  const paidBarrelKinds = new Set(
    allUserCharges
      .filter((row) => row.paidAt)
      .map((row) => `${row.chargeKind}:${row.barrelId}`),
  );
  const freightChargeIdByBarrel = new Map(
    allUserCharges
      .filter((row) => row.chargeKind === "freight")
      .map((row) => [row.barrelId, row.id] as const),
  );
  const [companyRates, destinationAddress] = await Promise.all([
    listOutboundShippingCompanyRates().catch((e) => {
      console.error("[loadChargeViewsForBarrelIds] company rates", e);
      return [] as Awaited<ReturnType<typeof listOutboundShippingCompanyRates>>;
    }),
    getPrimaryShippingAddress(clerkUserId).catch((e) => {
      console.error("[loadChargeViewsForBarrelIds] destination address", e);
      return undefined;
    }),
  ]);
  const courierZoneHints = destinationCourierZoneHints({
    parish: destinationAddress?.parish,
    cityOrTown: destinationAddress?.cityOrTown,
  });
  let partnerRows: {
    barrelId: string;
    chargeKind: string;
    name: string;
    imageUrl: string | null;
    isPrimary: boolean;
  }[] = [];
  if (userActiveBarrels.length > 0) {
    try {
      partnerRows = await db
        .select({
          barrelId: barrelOutboundShippingPartners.barrelId,
          chargeKind: barrelOutboundShippingPartners.chargeKind,
          name: barrelOutboundShippingPartners.name,
          imageUrl: barrelOutboundShippingPartners.imageUrl,
          isPrimary: barrelOutboundShippingPartners.isPrimary,
        })
        .from(barrelOutboundShippingPartners)
        .where(
          inArray(
            barrelOutboundShippingPartners.barrelId,
            userActiveBarrels.map((row) => row.id),
          ),
        );
    } catch (e) {
      console.error("[loadChargeViewsForBarrelIds] partner images", e);
    }
  }
  const partnerImageByBarrelKind = new Map<string, string>();
  const partnerImageByCompanyKind = new Map<string, string>();
  for (const row of partnerRows) {
    const url = row.imageUrl?.trim();
    if (!url) continue;
    const kind = isBarrelOutboundShippingChargeKind(row.chargeKind)
      ? row.chargeKind
      : "freight";
    const key = outboundShippingCompanyKey(row.name);
    if (row.isPrimary) {
      partnerImageByBarrelKind.set(`${row.barrelId}:${kind}`, url);
    }
    if (key && !partnerImageByCompanyKind.has(`${kind}:${key}`)) {
      partnerImageByCompanyKind.set(`${kind}:${key}`, url);
    }
  }

  const byBarrel = new Map<string, BarrelOutboundShippingChargeView[]>();
  for (const charge of charges) {
    const bundle = bundleByBarrel.get(charge.barrelId) ?? [];
    const companyRateKinds = companyRateKindsByBarrel.get(charge.barrelId) ?? [];
    const chargeKind = isBarrelOutboundShippingChargeKind(charge.chargeKind)
      ? charge.chargeKind
      : "freight";
    let lines = linesByCharge.get(charge.id) ?? [];
    const companyKey = outboundShippingCompanyKey(charge.partnerName ?? "");
    const linkedUnpaidIds = (() => {
      if (!companyKey) return [charge.barrelId];
      const linked = linkedBarrelIdsForCompanyKind(
        linkGroups,
        companyKey,
        chargeKind,
      );
      if (!linked.includes(charge.barrelId) || linked.length < 2) {
        return [charge.barrelId];
      }
      return linked.filter(
        (id) => !paidBarrelKinds.has(`${chargeKind}:${id}`),
      );
    })();
    const containerCount = rateCardContainerCount(linkedUnpaidIds);
    const linkedContainers =
      !charge.paidAt && linkedUnpaidIds.length >= 2
        ? linkedUnpaidIds.map((id) => ({
            barrelId: id,
            alias: aliasMap.get(id) ?? "Container",
          }))
        : [];
    const linkedFreightInCart =
      chargeKind === "freight" &&
      linkedUnpaidIds.some((id) => {
        const siblingId = freightChargeIdByBarrel.get(id);
        return Boolean(siblingId && inCartIds.has(siblingId));
      });
    if (
      !charge.paidAt &&
      chargeKindUsesCompanyRates(chargeKind, companyRateKinds, bundle)
    ) {
      const absorbed = isOutboundChargeKindAbsorbed(chargeKind, bundle);
      const host = outboundChargeBundleHost(bundle);
      if (absorbed && host && companyRateKinds.includes(host)) {
        lines = [];
      } else {
        lines = resolveCompanyRateLinesForKinds({
          rates: companyRates,
          companyName: charge.partnerName,
          kinds: companyRateKindsToPrice({
            chargeKind,
            bundle,
            companyRateKinds,
          }),
          containerKind: containerKindByBarrel.get(charge.barrelId) ?? "barrel",
          destinationHints: courierZoneHints,
          containerCount,
        });
      }
    }
    const list = byBarrel.get(charge.barrelId) ?? [];
    list.push({
      chargeId: charge.id,
      chargeKind,
      partnerName: charge.partnerName,
      partnerLocation: charge.partnerLocation,
      partnerAddress: charge.partnerAddress,
      partnerCountry: charge.partnerCountry,
      partnerPhone: charge.partnerPhone,
      partnerCashappId: charge.partnerCashappId,
      partnerCashappAccount: charge.partnerCashappAccount,
      partnerZelleId: charge.partnerZelleId,
      partnerZelleAccount: charge.partnerZelleAccount,
      partnerImageUrl:
        partnerImageByBarrelKind.get(`${charge.barrelId}:${chargeKind}`) ??
        (companyKey
          ? (partnerImageByCompanyKind.get(`${chargeKind}:${companyKey}`) ??
            null)
          : null),
      lines,
      totalCents: sumChargeLineCents(lines),
      adminNote: charge.adminNote,
      inCart: chargeKind === "freight" && linkedFreightInCart,
      paidAt: charge.paidAt,
      paymentReferenceNumber: charge.paymentReferenceNumber,
      paidOrderId: charge.paidOrderId,
      offPlatformPaymentMethod: isOffPlatformPaymentMethod(
        charge.offPlatformPaymentMethod,
      )
        ? charge.offPlatformPaymentMethod
        : null,
      offPlatformPayerName: charge.offPlatformPayerName,
      offPlatformReceiptUrl: charge.offPlatformReceiptUrl,
      offPlatformSubmittedAt: charge.offPlatformSubmittedAt,
      shipmentTracking: trackingByBarrel.get(charge.barrelId) ?? null,
      updatedByClerkUserId: charge.recordedByClerkUserId,
      chargeBundle: bundle,
      companyRateKinds,
      linkedContainers,
    });
    byBarrel.set(charge.barrelId, list);
  }
  return byBarrel;
}

export async function getOutboundShippingChargesByBarrelIds(
  clerkUserId: string,
  barrelIds: string[],
): Promise<Map<string, BarrelOutboundShippingChargeView[]>> {
  await ensureBarrelShippingIntakesSchema();
  try {
    return await loadChargeViewsForBarrelIds(clerkUserId, barrelIds);
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      try {
        if (await ensureBarrelOutboundShippingChargesSchema()) {
          return await loadChargeViewsForBarrelIds(clerkUserId, barrelIds);
        }
      } catch (retryError) {
        console.error(
          "[getOutboundShippingChargesByBarrelIds] retry",
          retryError,
        );
      }
    } else {
      console.error("[getOutboundShippingChargesByBarrelIds]", e);
    }
    return new Map();
  }
}

export async function listUserOutboundShippingCartLines(
  clerkUserId: string,
): Promise<OutboundShippingCartLineView[]> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  const cartRows = await db
    .select({
      charge: barrelOutboundShippingCharges,
      barrel: barrels,
      oci: orderContainerItemSnapshotColumns,
    })
    .from(userOutboundShippingCartLines)
    .innerJoin(
      barrelOutboundShippingCharges,
      eq(userOutboundShippingCartLines.chargeId, barrelOutboundShippingCharges.id),
    )
    .innerJoin(barrels, eq(barrelOutboundShippingCharges.barrelId, barrels.id))
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, clerkUserId),
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
      ),
    );

  if (cartRows.length === 0) {
    return [];
  }

  const barrelIds = [...new Set(cartRows.map((r) => r.barrel.id))];
  const siblingCharges = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      barrelId: barrelOutboundShippingCharges.barrelId,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.barrelId, barrelIds),
      ),
    );
  const chargeIds = [...new Set(siblingCharges.map((row) => row.id))];
  const lineRows = await db
    .select()
    .from(barrelOutboundShippingChargeLines)
    .where(inArray(barrelOutboundShippingChargeLines.chargeId, chargeIds))
    .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));

  const linesByCharge = new Map<string, OutboundShippingChargeLineView[]>();
  for (const line of lineRows) {
    const list = linesByCharge.get(line.chargeId) ?? [];
    list.push({ label: line.label, amountCents: line.amountCents });
    linesByCharge.set(line.chargeId, list);
  }
  const siblingsByBarrel = new Map<string, typeof siblingCharges>();
  for (const sibling of siblingCharges) {
    const list = siblingsByBarrel.get(sibling.barrelId) ?? [];
    list.push(sibling);
    siblingsByBarrel.set(sibling.barrelId, list);
  }

  const aliasMap = buildContainerAliasMap(
    cartRows.map((r) => ({
      barrelId: r.barrel.id,
      kind: parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel"),
      createdAt: r.barrel.createdAt,
    })),
  );

  const companyRates = await listOutboundShippingCompanyRates();
  const destinationAddress = await getPrimaryShippingAddress(clerkUserId).catch(
    (e) => {
      console.error("[listUserOutboundShippingCartLines] address", e);
      return undefined;
    },
  );
  const courierZoneHints = destinationCourierZoneHints({
    parish: destinationAddress?.parish,
    cityOrTown: destinationAddress?.cityOrTown,
  });
  const linkGroups = groupCompanyRateLinks(
    await listOutboundShippingCompanyRateLinksForUser(clerkUserId),
  );
  const paidBarrelKinds = new Set(
    siblingCharges
      .filter((row) => row.paidAt)
      .map((row) => `${row.chargeKind}:${row.barrelId}`),
  );
  const allUserPaid = await db
    .select({
      barrelId: barrelOutboundShippingCharges.barrelId,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId));
  for (const row of allUserPaid) {
    if (row.paidAt) {
      paidBarrelKinds.add(`${row.chargeKind}:${row.barrelId}`);
    }
  }

  const mapped = cartRows
    .filter(
      (r) =>
        isBarrelOutboundShippingChargeKind(r.charge.chargeKind) &&
        r.charge.chargeKind === "freight",
    )
    .map((r) => {
    const kind = parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel");
    const alias =
      aliasMap.get(r.barrel.id) ?? (kind === "barrel" ? "Barrel" : "Bin");
    const oci = r.oci;
    const slotLabel =
      oci ?
        formatBarrelSlotLabel({
          nameSnapshot: oci.nameSnapshot,
          sizeSnapshot: oci.sizeSnapshot,
          unitOrdinal: r.barrel.unitOrdinal,
        })
      : `Container ${r.barrel.id.slice(0, 8)}…`;
    const storedLines = linesByCharge.get(r.charge.id) ?? [];
    const bundle = parseOutboundChargeBundle(r.barrel.outboundChargeBundle);
    const companyRateKinds = parseOutboundCompanyRateKinds(
      r.barrel.outboundCompanyRateKinds,
    );
    const usesCompanyRates =
      !r.charge.paidAt &&
      chargeKindUsesCompanyRates("freight", companyRateKinds, bundle);
    const companyKey = outboundShippingCompanyKey(r.charge.partnerName ?? "");
    const linked = companyKey
      ? linkedBarrelIdsForCompanyKind(linkGroups, companyKey, "freight")
      : [];
    const linkedUnpaidIds =
      linked.includes(r.barrel.id) && linked.length >= 2
        ? linked.filter((id) => !paidBarrelKinds.has(`freight:${id}`))
        : [r.barrel.id];
    const containerCount = rateCardContainerCount(linkedUnpaidIds);
    let mergedLines = storedLines;
    if (usesCompanyRates) {
      mergedLines = resolveCompanyRateLinesForKinds({
        rates: companyRates,
        companyName: r.charge.partnerName,
        kinds: companyRateKindsToPrice({
          chargeKind: "freight",
          bundle,
          companyRateKinds,
        }),
        containerKind: kind,
        destinationHints: courierZoneHints,
        containerCount,
      });
    } else {
      const extraLines = (siblingsByBarrel.get(r.barrel.id) ?? [])
        .filter(
          (other) =>
            isBarrelOutboundShippingChargeKind(other.chargeKind) &&
            isOutboundChargeKindAbsorbed(other.chargeKind, bundle) &&
            !companyRateKinds.includes(other.chargeKind),
        )
        .flatMap((other) => linesByCharge.get(other.id) ?? []);
      mergedLines = [...storedLines, ...extraLines];
    }

    const linkedAlias =
      linkedUnpaidIds.length >= 2
        ? linkedUnpaidIds
            .map((id) => aliasMap.get(id) ?? "Container")
            .join(" + ")
        : alias;

    return {
      chargeId: r.charge.id,
      barrelId: r.barrel.id,
      alias: linkedAlias,
      slotLabel,
      kind,
      chargeKind: "freight" as const,
      partnerName: r.charge.partnerName,
      partnerAddress: r.charge.partnerAddress,
      partnerCountry: r.charge.partnerCountry,
      lines: mergedLines,
      totalCents: sumChargeLineCents(mergedLines),
      adminNote: r.charge.adminNote,
      linkKey:
        linkedUnpaidIds.length >= 2
          ? `${companyKey}:freight`
          : r.charge.id,
    };
  });

  const seenLink = new Set<string>();
  return mapped
    .filter((line) => {
      if (seenLink.has(line.linkKey)) return false;
      seenLink.add(line.linkKey);
      return true;
    })
    .map(({ linkKey: _linkKey, ...line }) => line);
}

export function sumOutboundShippingCartLinesCents(
  lines: OutboundShippingCartLineView[],
): number {
  return lines.reduce((s, l) => s + l.totalCents, 0);
}

/** Lightweight count of outbound shipping charges in the user's cart (header badge). */
export async function countUserOutboundShippingCartLineRows(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  try {
    const rows = await db
      .select({ chargeKind: barrelOutboundShippingCharges.chargeKind })
      .from(userOutboundShippingCartLines)
      .innerJoin(
        barrelOutboundShippingCharges,
        eq(
          userOutboundShippingCartLines.chargeId,
          barrelOutboundShippingCharges.id,
        ),
      )
      .where(
        and(
          eq(userOutboundShippingCartLines.clerkUserId, clerkUserId),
          eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        ),
      );
    return rows.filter((row) => row.chargeKind === "freight").length;
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return 0;
    }
    throw e;
  }
}

/**
 * Stripe Checkout line items for outbound container shipping. Each itemized
 * charge (freight, customs, pickup, etc.) becomes its own checkout line so the
 * customer clearly sees what they are paying for. If a container has any line
 * below Stripe's per-line minimum, that container falls back to a single
 * combined line whose description still spells out every charge and amount.
 */
export function buildStripeLineItemsFromOutboundShippingCart(
  lines: OutboundShippingCartLineView[],
): StripeCheckoutPriceDataLine[] {
  const items: StripeCheckoutPriceDataLine[] = [];

  for (const line of lines) {
    const chargeLines = line.lines.filter((l) => l.amountCents > 0);

    if (chargeLines.length === 0) {
      items.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: line.totalCents,
          product_data: {
            name: `Outbound shipping — ${line.alias}`,
            description: line.slotLabel,
          },
        },
      });
      continue;
    }

    const canItemize = chargeLines.every(
      (l) => l.amountCents >= STRIPE_CHECKOUT_LINE_MIN_US_CENTS,
    );

    if (canItemize) {
      for (const charge of chargeLines) {
        items.push({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: charge.amountCents,
            product_data: {
              name: `Shipping: ${charge.label}`,
              description: `${line.alias} · ${line.slotLabel}${
                line.partnerName ? ` · ${line.partnerName}` : ""
              }`,
            },
          },
        });
      }
      continue;
    }

    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: line.totalCents,
        product_data: {
          name: `Outbound shipping — ${line.alias}`,
          description: `${line.slotLabel} · ${chargeLines
            .map((l) => `${l.label} ${formatUsd(l.amountCents)}`)
            .join(", ")}`,
        },
      },
    });
  }

  return items;
}

export async function clearOutboundShippingCartForCharges(
  clerkUserId: string,
  chargeIds: string[],
): Promise<void> {
  if (chargeIds.length === 0) return;
  const db = getDb();
  await db
    .delete(userOutboundShippingCartLines)
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, clerkUserId),
        inArray(userOutboundShippingCartLines.chargeId, chargeIds),
      ),
    );
}

/**
 * Re-adds outbound shipping charges to the user's cart after an abandoned/cancelled
 * checkout (charges are cleared from the cart when a Stripe session is created).
 * Only restores charges the user owns that are still unpaid; existing rows are kept.
 */
export async function restoreOutboundShippingCartForCharges(
  clerkUserId: string,
  chargeIds: string[],
): Promise<void> {
  if (chargeIds.length === 0) return;
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  const restorable = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.id, chargeIds),
        isNull(barrelOutboundShippingCharges.paidAt),
      ),
    );
  const freightOnly = restorable.filter((c) => c.chargeKind === "freight");
  if (freightOnly.length === 0) return;

  await db
    .insert(userOutboundShippingCartLines)
    .values(freightOnly.map((c) => ({ clerkUserId, chargeId: c.id })))
    .onConflictDoNothing();
}

export async function markOutboundShippingChargesPaid(
  clerkUserId: string,
  chargeIds: string[],
  payment: { orderId: string; stripePaymentIntentId: string },
): Promise<void> {
  if (chargeIds.length === 0) return;
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureBarrelOutboundShipmentTrackingSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const expandedIds = await expandChargeIdsWithCompanyRateLinks({
    clerkUserId,
    chargeIds,
  });

  const charges = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      barrelId: barrelOutboundShippingCharges.barrelId,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.id, expandedIds),
      ),
    );

  const paidBarrelIds = [...new Set(charges.map((charge) => charge.barrelId))];
  const bundleRows =
    paidBarrelIds.length > 0
      ? await db
          .select({
            id: barrels.id,
            outboundChargeBundle: barrels.outboundChargeBundle,
          })
          .from(barrels)
          .where(inArray(barrels.id, paidBarrelIds))
      : [];
  const bundleByBarrel = new Map(
    bundleRows.map((row) => [
      row.id,
      parseOutboundChargeBundle(row.outboundChargeBundle),
    ]),
  );

  const absorbed =
    paidBarrelIds.length > 0
      ? await db
          .select({
            id: barrelOutboundShippingCharges.id,
            barrelId: barrelOutboundShippingCharges.barrelId,
            chargeKind: barrelOutboundShippingCharges.chargeKind,
            paidAt: barrelOutboundShippingCharges.paidAt,
          })
          .from(barrelOutboundShippingCharges)
          .where(
            and(
              eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
              inArray(barrelOutboundShippingCharges.barrelId, paidBarrelIds),
            ),
          )
      : [];

  const toPay = new Map(charges.map((charge) => [charge.id, charge]));
  for (const sibling of absorbed) {
    if (sibling.paidAt || toPay.has(sibling.id)) continue;
    if (!isBarrelOutboundShippingChargeKind(sibling.chargeKind)) continue;
    const bundle = bundleByBarrel.get(sibling.barrelId) ?? [];
    if (!isOutboundChargeKindAbsorbed(sibling.chargeKind, bundle)) continue;
    const hostPaid = charges.some(
      (charge) =>
        charge.barrelId === sibling.barrelId &&
        isBarrelOutboundShippingChargeKind(charge.chargeKind) &&
        charge.chargeKind === outboundChargeBundleHost(bundle),
    );
    if (hostPaid) {
      toPay.set(sibling.id, sibling);
    }
  }

  for (const charge of toPay.values()) {
    if (charge.paidAt) {
      continue;
    }
    const paymentReferenceNumber = await generateOutboundShippingPaymentReference();
    await db
      .update(barrelOutboundShippingCharges)
      .set({
        paidAt: now,
        updatedAt: now,
        paymentReferenceNumber,
        paidOrderId: payment.orderId,
        stripePaymentIntentId: payment.stripePaymentIntentId,
      })
      .where(eq(barrelOutboundShippingCharges.id, charge.id));

    await upsertShipmentTrackingOnFreightPaid({
      barrelId: charge.barrelId,
      chargeId: charge.id,
    });
  }
}

export async function getOutboundShippingChargeForUser(
  clerkUserId: string,
  chargeId: string,
): Promise<
  | {
      charge: typeof barrelOutboundShippingCharges.$inferSelect;
    }
  | undefined
> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      charge: barrelOutboundShippingCharges,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.id, chargeId),
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);

  return row;
}

export async function recordOutboundOffPlatformPayment(input: {
  clerkUserId: string;
  chargeId: string;
  paymentMethod: OffPlatformPaymentMethod;
  payerAccountName: string | null;
  receiptUrl: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [charge] = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.id, input.chargeId),
        eq(barrelOutboundShippingCharges.clerkUserId, input.clerkUserId),
      ),
    )
    .limit(1);
  if (!charge) {
    return { ok: false, message: "Shipping charge not found." };
  }
  if (!isBarrelOutboundShippingChargeKind(charge.chargeKind) ||
      !isOffPlatformOutboundChargeKind(charge.chargeKind)) {
    return {
      ok: false,
      message: "This charge is paid through the cart, not Zelle or Cash App.",
    };
  }
  if (charge.paidAt) {
    return { ok: false, message: "This charge is already marked paid." };
  }
  const replacingLocalOffice =
    Boolean(charge.offPlatformSubmittedAt) &&
    charge.offPlatformPaymentMethod === "local_office" &&
    (input.paymentMethod === "zelle" || input.paymentMethod === "cashapp");
  if (charge.offPlatformSubmittedAt && !replacingLocalOffice) {
    return { ok: false, message: "This charge already has a payment on file." };
  }

  const now = new Date().toISOString();

  await db
    .update(barrelOutboundShippingCharges)
    .set({
      offPlatformPaymentMethod: input.paymentMethod,
      offPlatformPayerName: input.payerAccountName,
      offPlatformReceiptUrl: input.receiptUrl,
      offPlatformSubmittedAt: now,
      updatedAt: now,
    })
    .where(eq(barrelOutboundShippingCharges.id, charge.id));

  const linkedIds = await expandChargeIdsWithCompanyRateLinks({
    clerkUserId: input.clerkUserId,
    chargeIds: [charge.id],
  });
  for (const id of linkedIds) {
    if (id === charge.id) continue;
    await db
      .update(barrelOutboundShippingCharges)
      .set({
        offPlatformPaymentMethod: input.paymentMethod,
        offPlatformPayerName: input.payerAccountName,
        offPlatformReceiptUrl: input.receiptUrl,
        offPlatformSubmittedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(barrelOutboundShippingCharges.id, id),
          eq(barrelOutboundShippingCharges.clerkUserId, input.clerkUserId),
          isNull(barrelOutboundShippingCharges.paidAt),
        ),
      );
  }

  await db
    .delete(userOutboundShippingCartLines)
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, input.clerkUserId),
        inArray(userOutboundShippingCartLines.chargeId, linkedIds),
      ),
    );

  return { ok: true };
}

export async function approveOutboundOffPlatformPayment(
  chargeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [charge] = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(eq(barrelOutboundShippingCharges.id, chargeId))
    .limit(1);
  if (!charge) {
    return { ok: false, message: "Shipping charge not found." };
  }
  if (
    !isBarrelOutboundShippingChargeKind(charge.chargeKind) ||
    !isOffPlatformOutboundChargeKind(charge.chargeKind)
  ) {
    return { ok: false, message: "This charge is not a broker or courier payment." };
  }
  if (charge.paidAt) {
    return { ok: false, message: "This charge is already approved as paid." };
  }
  if (!charge.offPlatformSubmittedAt) {
    return {
      ok: false,
      message: "The customer has not submitted a payment for this charge yet.",
    };
  }

  const now = new Date().toISOString();
  const paymentReferenceNumber = await generateOutboundShippingPaymentReference();
  const expandedIds = await expandChargeIdsWithCompanyRateLinks({
    clerkUserId: charge.clerkUserId,
    chargeIds: [charge.id],
  });
  for (const id of expandedIds) {
    const [sibling] = await db
      .select({
        id: barrelOutboundShippingCharges.id,
        paidAt: barrelOutboundShippingCharges.paidAt,
      })
      .from(barrelOutboundShippingCharges)
      .where(eq(barrelOutboundShippingCharges.id, id))
      .limit(1);
    if (!sibling || sibling.paidAt) continue;
    await db
      .update(barrelOutboundShippingCharges)
      .set({
        paidAt: now,
        paymentReferenceNumber:
          sibling.id === charge.id
            ? paymentReferenceNumber
            : await generateOutboundShippingPaymentReference(),
        updatedAt: now,
      })
      .where(eq(barrelOutboundShippingCharges.id, sibling.id));
  }

  return { ok: true };
}

/**
 * Copies the latest published freight quote (Tropical Shipping, line amounts)
 * onto active barrels that do not have a freight charge yet.
 */
export async function seedDefaultOutboundChargesForUser(
  clerkUserId: string,
): Promise<void> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  const activeBarrels = await db
    .select({ id: barrels.id })
    .from(barrels)
    .where(
      and(
        eq(barrels.clerkUserId, clerkUserId),
        notInArray(barrels.status, ["shipped", "delivered"]),
      ),
    );
  if (activeBarrels.length === 0) {
    return;
  }

  const barrelIds = activeBarrels.map((row) => row.id);
  const existingFreight = await db
    .select({ barrelId: barrelOutboundShippingCharges.barrelId })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        inArray(barrelOutboundShippingCharges.barrelId, barrelIds),
        eq(barrelOutboundShippingCharges.chargeKind, "freight"),
      ),
    );
  const alreadyHasFreight = new Set(existingFreight.map((row) => row.barrelId));
  const missing = activeBarrels.filter((row) => !alreadyHasFreight.has(row.id));
  if (missing.length === 0) {
    return;
  }

  const template = await findDefaultFreightChargeTemplate(clerkUserId);
  if (!template) {
    return;
  }

  for (const barrel of missing) {
    try {
      await copyFreightChargeTemplateToBarrel({
        destBarrelId: barrel.id,
        destClerkUserId: clerkUserId,
        template,
      });
    } catch (e) {
      console.error(
        "[seedDefaultOutboundChargesForUser] copy freight",
        barrel.id,
        e,
      );
    }
  }
}

type FreightChargeTemplate = {
  charge: typeof barrelOutboundShippingCharges.$inferSelect;
  lines: { label: string; amountCents: number; sortIndex: number }[];
};

async function freightTemplateFromCharges(
  charges: (typeof barrelOutboundShippingCharges.$inferSelect)[],
): Promise<FreightChargeTemplate | null> {
  const db = getDb();
  for (const charge of charges) {
    const lineRows = await db
      .select({
        label: barrelOutboundShippingChargeLines.label,
        amountCents: barrelOutboundShippingChargeLines.amountCents,
        sortIndex: barrelOutboundShippingChargeLines.sortIndex,
      })
      .from(barrelOutboundShippingChargeLines)
      .where(eq(barrelOutboundShippingChargeLines.chargeId, charge.id))
      .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));
    const lines = lineRows.filter((line) => line.amountCents > 0);
    if (lines.length > 0) {
      return { charge, lines };
    }
  }
  return null;
}

async function findDefaultFreightChargeTemplate(
  preferClerkUserId: string,
): Promise<FreightChargeTemplate | null> {
  const db = getDb();
  const own = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, preferClerkUserId),
        eq(barrelOutboundShippingCharges.chargeKind, "freight"),
      ),
    )
    .orderBy(desc(barrelOutboundShippingCharges.updatedAt))
    .limit(8);
  const fromOwn = await freightTemplateFromCharges(own);
  if (fromOwn) {
    return fromOwn;
  }

  const any = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(eq(barrelOutboundShippingCharges.chargeKind, "freight"))
    .orderBy(desc(barrelOutboundShippingCharges.updatedAt))
    .limit(12);
  return freightTemplateFromCharges(any);
}

async function copyFreightChargeTemplateToBarrel(input: {
  destBarrelId: string;
  destClerkUserId: string;
  template: FreightChargeTemplate;
}): Promise<void> {
  const db = getDb();
  const source = input.template.charge;
  const partner =
    (await getPrimaryOutboundShippingPartner(source.barrelId, "freight")) ?? null;

  const [inserted] = await db
    .insert(barrelOutboundShippingCharges)
    .values({
      barrelId: input.destBarrelId,
      clerkUserId: input.destClerkUserId,
      chargeKind: "freight",
      partnerName: partner?.name ?? source.partnerName,
      partnerLocation: null,
      partnerAddress: partner?.address ?? source.partnerAddress,
      partnerCountry: null,
      partnerPhone: partner?.phone ?? source.partnerPhone,
      partnerCashappId: partner?.cashappId ?? source.partnerCashappId,
      partnerCashappAccount:
        partner?.cashappAccount ?? source.partnerCashappAccount,
      partnerZelleId: partner?.zelleId ?? source.partnerZelleId,
      partnerZelleAccount: partner?.zelleAccount ?? source.partnerZelleAccount,
      adminNote: source.adminNote,
      recordedByClerkUserId: source.recordedByClerkUserId,
    })
    .onConflictDoNothing({
      target: [
        barrelOutboundShippingCharges.barrelId,
        barrelOutboundShippingCharges.chargeKind,
      ],
    })
    .returning({ id: barrelOutboundShippingCharges.id });

  const chargeId = inserted?.id;
  if (!chargeId) {
    return;
  }

  await db.insert(barrelOutboundShippingChargeLines).values(
    input.template.lines.map((line) => ({
      chargeId,
      label: line.label,
      amountCents: line.amountCents,
      sortIndex: line.sortIndex,
    })),
  );

  const partnerName = (partner?.name ?? source.partnerName)?.trim();
  if (partnerName) {
    await addOutboundShippingPartner({
      barrelId: input.destBarrelId,
      chargeKind: "freight",
      name: partnerName,
      location: null,
      address: partner?.address ?? source.partnerAddress,
      country: null,
      phone: partner?.phone ?? source.partnerPhone,
      cashappId: partner?.cashappId ?? source.partnerCashappId,
      cashappAccount: partner?.cashappAccount ?? source.partnerCashappAccount,
      zelleId: partner?.zelleId ?? source.partnerZelleId,
      zelleAccount: partner?.zelleAccount ?? source.partnerZelleAccount,
      imageUrl: partner?.imageUrl ?? null,
      isPrimary: true,
    });
  }

  const [sourceBarrel] = await db
    .select({
      outboundChargeBundle: barrels.outboundChargeBundle,
      outboundCompanyRateKinds: barrels.outboundCompanyRateKinds,
    })
    .from(barrels)
    .where(eq(barrels.id, source.barrelId))
    .limit(1);
  const bundle = parseOutboundChargeBundle(sourceBarrel?.outboundChargeBundle);
  const companyRateKinds = parseOutboundCompanyRateKinds(
    sourceBarrel?.outboundCompanyRateKinds,
  );
  if (companyRateKinds.length > 0) {
    await db
      .update(barrels)
      .set({
        outboundCompanyRateKinds:
          serializeOutboundCompanyRateKinds(companyRateKinds),
      })
      .where(eq(barrels.id, input.destBarrelId));
  }
  if (bundle.length < 2) {
    return;
  }

  await db
    .update(barrels)
    .set({ outboundChargeBundle: serializeOutboundChargeBundle(bundle) })
    .where(eq(barrels.id, input.destBarrelId));

  await copyBundledChargesToBarrel({
    sourceBarrelId: source.barrelId,
    destBarrelId: input.destBarrelId,
    destClerkUserId: input.destClerkUserId,
    bundle,
  });
}

async function copyBundledChargesToBarrel(input: {
  sourceBarrelId: string;
  destBarrelId: string;
  destClerkUserId: string;
  bundle: BarrelOutboundShippingChargeKind[];
}): Promise<void> {
  const db = getDb();
  const host = outboundChargeBundleHost(input.bundle) ?? "freight";
  const hostPartner =
    (await getPrimaryOutboundShippingPartner(input.destBarrelId, host)) ??
    (await getPrimaryOutboundShippingPartner(input.sourceBarrelId, host));

  for (const kind of input.bundle) {
    const [existing] = await db
      .select({ id: barrelOutboundShippingCharges.id })
      .from(barrelOutboundShippingCharges)
      .where(
        and(
          eq(barrelOutboundShippingCharges.barrelId, input.destBarrelId),
          eq(barrelOutboundShippingCharges.chargeKind, kind),
        ),
      )
      .limit(1);

    if (!existing) {
      const [sourceCharge] = await db
        .select()
        .from(barrelOutboundShippingCharges)
        .where(
          and(
            eq(barrelOutboundShippingCharges.barrelId, input.sourceBarrelId),
            eq(barrelOutboundShippingCharges.chargeKind, kind),
          ),
        )
        .limit(1);
      if (sourceCharge) {
        const lineRows = await db
          .select({
            label: barrelOutboundShippingChargeLines.label,
            amountCents: barrelOutboundShippingChargeLines.amountCents,
            sortIndex: barrelOutboundShippingChargeLines.sortIndex,
          })
          .from(barrelOutboundShippingChargeLines)
          .where(eq(barrelOutboundShippingChargeLines.chargeId, sourceCharge.id))
          .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));
        const lines = lineRows.filter((line) => line.amountCents > 0);
        if (lines.length > 0) {
          const [inserted] = await db
            .insert(barrelOutboundShippingCharges)
            .values({
              barrelId: input.destBarrelId,
              clerkUserId: input.destClerkUserId,
              chargeKind: kind,
              partnerName: hostPartner?.name ?? sourceCharge.partnerName,
              partnerLocation:
                kind === "freight" ? null : (hostPartner?.location ?? null),
              partnerAddress: hostPartner?.address ?? sourceCharge.partnerAddress,
              partnerCountry:
                kind === "freight" ? null : (hostPartner?.country ?? null),
              partnerPhone: hostPartner?.phone ?? sourceCharge.partnerPhone,
              partnerCashappId:
                hostPartner?.cashappId ?? sourceCharge.partnerCashappId,
              partnerCashappAccount:
                hostPartner?.cashappAccount ??
                sourceCharge.partnerCashappAccount,
              partnerZelleId: hostPartner?.zelleId ?? sourceCharge.partnerZelleId,
              partnerZelleAccount:
                hostPartner?.zelleAccount ?? sourceCharge.partnerZelleAccount,
              adminNote: sourceCharge.adminNote,
              recordedByClerkUserId: sourceCharge.recordedByClerkUserId,
            })
            .onConflictDoNothing({
              target: [
                barrelOutboundShippingCharges.barrelId,
                barrelOutboundShippingCharges.chargeKind,
              ],
            })
            .returning({ id: barrelOutboundShippingCharges.id });
          if (inserted?.id) {
            await db.insert(barrelOutboundShippingChargeLines).values(
              lines.map((line) => ({
                chargeId: inserted.id,
                label: line.label,
                amountCents: line.amountCents,
                sortIndex: line.sortIndex,
              })),
            );
          }
        }
      }
    }

    if (hostPartner?.name.trim() && kind !== host) {
      await addOutboundShippingPartner({
        barrelId: input.destBarrelId,
        chargeKind: kind,
        name: hostPartner.name,
        location: hostPartner.location,
        address: hostPartner.address,
        country: hostPartner.country,
        phone: hostPartner.phone,
        cashappId: hostPartner.cashappId,
        cashappAccount: hostPartner.cashappAccount,
        zelleId: hostPartner.zelleId,
        zelleAccount: hostPartner.zelleAccount,
        imageUrl: hostPartner.imageUrl,
        isPrimary: true,
      });
    }
  }
}

export async function setOutboundChargeBundleForBarrel(input: {
  barrelId: string;
  kinds: BarrelOutboundShippingChargeKind[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [barrel] = await db
    .select({
      id: barrels.id,
      clerkUserId: barrels.clerkUserId,
    })
    .from(barrels)
    .where(eq(barrels.id, input.barrelId))
    .limit(1);
  if (!barrel) {
    return { ok: false, message: "Container not found." };
  }

  const serialized = serializeOutboundChargeBundle(input.kinds);
  await db
    .update(barrels)
    .set({ outboundChargeBundle: serialized })
    .where(eq(barrels.id, input.barrelId));

  const bundle = parseOutboundChargeBundle(serialized);
  if (bundle.length >= 2) {
    await syncBundlePartnersFromHost(input.barrelId, bundle);
    const siblings = await db
      .select({ id: barrels.id })
      .from(barrels)
      .where(
        and(
          eq(barrels.clerkUserId, barrel.clerkUserId),
          notInArray(barrels.status, ["shipped", "delivered"]),
        ),
      );
    for (const sibling of siblings) {
      if (sibling.id === input.barrelId) continue;
      await db
        .update(barrels)
        .set({ outboundChargeBundle: serialized })
        .where(eq(barrels.id, sibling.id));
      await copyBundledChargesToBarrel({
        sourceBarrelId: input.barrelId,
        destBarrelId: sibling.id,
        destClerkUserId: barrel.clerkUserId,
        bundle,
      });
    }
  }
  return { ok: true };
}

export async function setOutboundCompanyRateKindsForBarrel(input: {
  barrelId: string;
  kinds: BarrelOutboundShippingChargeKind[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [barrel] = await db
    .select({ id: barrels.id })
    .from(barrels)
    .where(eq(barrels.id, input.barrelId))
    .limit(1);
  if (!barrel) {
    if (isAdminShippingCatalogPreviewBarrelId(input.barrelId)) {
      return { ok: true };
    }
    return { ok: false, message: "Container not found." };
  }
  await db
    .update(barrels)
    .set({
      outboundCompanyRateKinds: serializeOutboundCompanyRateKinds(input.kinds),
    })
    .where(eq(barrels.id, input.barrelId));
  return { ok: true };
}

/** Clears broker/courier payment so the customer can submit receipts again. Freight stays paid. */
export async function resetBrokerAndCourierPaymentsForBarrel(
  clerkUserId: string,
  barrelId: string,
): Promise<void> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  await db
    .update(barrelOutboundShippingCharges)
    .set({
      offPlatformPaymentMethod: null,
      offPlatformPayerName: null,
      offPlatformReceiptUrl: null,
      offPlatformSubmittedAt: null,
      paidAt: null,
      paymentReferenceNumber: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        eq(barrelOutboundShippingCharges.barrelId, barrelId),
        inArray(barrelOutboundShippingCharges.chargeKind, ["broker", "courier"]),
      ),
    );
}
