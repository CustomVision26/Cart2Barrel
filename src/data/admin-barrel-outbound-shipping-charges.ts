import "server-only";

import { and, asc, eq, notInArray } from "drizzle-orm";

import { getDb } from "@/db";
import type { Address } from "@/db/schema";
import {
  barrelShippingIntakes,
  barrels,
  orderContainerItems,
  profiles,
} from "@/db/schema";
import { getPrimaryShippingAddressesByClerkUserIds } from "@/data/addresses";
import {
  ensureOrderContainerPackagingFeeColumns,
  orderContainerItemSnapshotColumns,
  type OrderContainerItemSnapshot,
} from "@/data/ensure-order-container-packaging-fee-schema";
import {
  getOutboundShippingChargesByBarrelIds,
} from "@/data/barrel-outbound-shipping-charges";
import {
  clearStaleCatalogChargeBundleClones,
  listOutboundShippingPartnerCatalog,
  listOutboundShippingPartnersByBarrelIds,
  mergePartnersWithCatalog,
} from "@/data/barrel-outbound-shipping-partners";
import { listOutboundShippingCompanyRates, seedKingdomKleanerzCourierZones } from "@/data/outbound-shipping-company-rates";
import { getOutboundShippingCatalogDefaults } from "@/data/outbound-shipping-catalog-defaults";
import {
  groupCompanyRateLinks,
  listOutboundShippingCompanyRateLinksForUser,
} from "@/data/outbound-shipping-company-rate-links";
import { getShipmentTrackingByBarrelIds } from "@/data/barrel-outbound-shipment-tracking";
import { getPrimaryImageUrlByOfferingIds } from "@/data/container-offerings";
import { formatShippingDestinationLines } from "@/lib/shipping-address-format";
import { ensureBarrelOutboundShipmentTrackingSchema } from "@/data/ensure-barrel-outbound-shipment-tracking-schema";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import { isContainerReadyForShippingIntake } from "@/lib/barrel-shipping-intake";
import type {
  AdminBarrelOutboundShippingChargeRow,
  AdminCompanyRateLinkGroup,
  AdminRateLinkableContainer,
  AdminShipmentChargePageData,
  AdminShipmentCustomerGroup,
  BarrelOutboundShippingChargeView,
  OutboundShippingCompanyRateRow,
  OutboundShippingPartnerRecord,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS,
  chargeViewForKind,
  outboundShippingCompanyKey,
  parseOutboundChargeBundle,
  parseOutboundCompanyRateKinds,
  primaryPartnerNameForKind,
  toIsoTimestamp,
} from "@/lib/barrel-outbound-shipping-charge";
import { sumOutboundChargesCents } from "@/lib/barrel-outbound-shipping-charge";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import { buildContainerAliasMap } from "@/lib/container-slot-alias";
import {
  isMissingBarrelOutboundShippingChargesTableError,
  isMissingOrderContainerPackagingFeeColumnError,
} from "@/lib/db-column-missing";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";

async function loadAllActiveBarrelRows(clerkUserId?: string) {
  const db = getDb();
  const activeStatus = notInArray(barrels.status, ["shipped", "delivered"]);
  return db
    .select({
      barrel: barrels,
      oci: orderContainerItemSnapshotColumns,
      profile: profiles,
      intake: barrelShippingIntakes,
    })
    .from(barrels)
    .innerJoin(profiles, eq(barrels.clerkUserId, profiles.clerkUserId))
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .leftJoin(
      barrelShippingIntakes,
      eq(barrelShippingIntakes.barrelId, barrels.id),
    )
    .where(
      clerkUserId ?
        and(activeStatus, eq(barrels.clerkUserId, clerkUserId))
      : activeStatus,
    )
    .orderBy(asc(profiles.fullName), asc(barrels.createdAt));
}

type AdminChargeSourceRow = {
  barrel: typeof barrels.$inferSelect;
  oci: OrderContainerItemSnapshot | null;
  profile: typeof profiles.$inferSelect | null;
  intake: typeof barrelShippingIntakes.$inferSelect | null;
};

function mapSingleAdminRow(
  r: AdminChargeSourceRow,
  aliasMap: Map<string, string>,
  imageByOfferingId: Map<string, string>,
  trackingByBarrel: Map<string, import("@/lib/barrel-shipment-tracking").BarrelOutboundShipmentTrackingView>,
  addressByUser: Map<string, Address>,
  chargesByBarrel: Map<string, BarrelOutboundShippingChargeView[]>,
  partnersByBarrel: Map<string, OutboundShippingPartnerRecord[]>,
  partnerCatalog: OutboundShippingPartnerRecord[],
  companyRates: OutboundShippingCompanyRateRow[],
): AdminBarrelOutboundShippingChargeRow {
  const address = addressByUser.get(r.barrel.clerkUserId);
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
  const containerName = oci?.nameSnapshot.trim() || alias;
  const offeringId = oci?.containerOfferingId ?? null;
  const containerImageUrl =
    offeringId ? (imageByOfferingId.get(offeringId) ?? null) : null;
  const charges = (chargesByBarrel.get(r.barrel.id) ?? []).map((charge) => ({
    ...charge,
    paidAt: toIsoTimestamp(charge.paidAt),
    offPlatformSubmittedAt: toIsoTimestamp(charge.offPlatformSubmittedAt),
    offPlatformReceiptUrl: charge.offPlatformReceiptUrl ?? null,
    offPlatformPayerName: charge.offPlatformPayerName ?? null,
    offPlatformPaymentMethod: charge.offPlatformPaymentMethod ?? null,
  }));
  const primary =
    charges.find((c) => c.chargeKind === "freight") ?? charges[0] ?? null;
  const readyForShipping = isContainerReadyForShippingIntake({
    status: r.barrel.status,
    capacityPercentage: r.barrel.capacityPercentage,
  });

  return {
    barrelId: r.barrel.id,
    intakeId: r.intake?.id ?? `awaiting-${r.barrel.id}`,
    clerkUserId: r.barrel.clerkUserId,
    customerEmail: r.profile?.email ?? null,
    customerName: r.profile?.fullName ?? null,
    alias,
    slotLabel,
    containerName,
    containerImageUrl,
    kind,
    status: r.barrel.status,
    capacityPercentage: r.barrel.capacityPercentage,
    readyForShipping,
    deliveryMethod: r.intake?.deliveryMethod ?? "customs_pickup",
    selectedBrokerKey: r.intake?.selectedBrokerKey ?? null,
    selectedCourierKey: r.intake?.selectedCourierKey ?? null,
    submittedAt: r.intake?.createdAt ?? r.barrel.createdAt,
    charges,
    partners: mergePartnersWithCatalog(
      partnersByBarrel.get(r.barrel.id) ?? [],
      partnerCatalog,
    ),
    chargeId: primary?.chargeId ?? null,
    adminNote: primary?.adminNote ?? null,
    lines: primary?.lines ?? [],
    totalCents: sumOutboundChargesCents(charges),
    paidAt: charges.every((c) => c.paidAt) && charges.length > 0
      ? charges[charges.length - 1]!.paidAt
      : null,
    paymentReferenceNumber: primary?.paymentReferenceNumber ?? null,
    shipmentTracking: trackingByBarrel.get(r.barrel.id) ?? null,
    destinationLines: address
      ? formatShippingDestinationLines(address)
      : [],
    destinationParish: address?.parish?.trim() || null,
    destinationCityOrTown: address?.cityOrTown?.trim() || null,
    updatedByClerkUserId:
      charges.find((c) => c.updatedByClerkUserId)?.updatedByClerkUserId ??
      null,
    chargeBundle: parseOutboundChargeBundle(r.barrel.outboundChargeBundle),
    companyRates,
    companyRateKinds: parseOutboundCompanyRateKinds(
      r.barrel.outboundCompanyRateKinds,
    ),
    rateLinkableContainers: [],
    companyRateLinks: [],
  };
}

function toRateLinkableContainer(
  row: AdminBarrelOutboundShippingChargeRow,
): AdminRateLinkableContainer {
  const partnerKeyByKind: AdminRateLinkableContainer["partnerKeyByKind"] = {};
  const unpaidByKind: AdminRateLinkableContainer["unpaidByKind"] = {};
  for (const kind of BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS) {
    const charge = chargeViewForKind(row.charges, kind);
    const name =
      charge?.partnerName?.trim() ||
      primaryPartnerNameForKind(row.partners, row.barrelId, kind);
    if (name) {
      partnerKeyByKind[kind] = outboundShippingCompanyKey(name);
    }
    unpaidByKind[kind] = !charge?.paidAt;
  }
  return {
    barrelId: row.barrelId,
    alias: row.alias,
    slotLabel: row.slotLabel,
    partnerKeyByKind,
    unpaidByKind,
    selectedCourierKey: row.selectedCourierKey,
  };
}

function buildCustomerGroups(
  sourceRows: AdminChargeSourceRow[],
  imageByOfferingId: Map<string, string>,
  trackingByBarrel: Map<string, import("@/lib/barrel-shipment-tracking").BarrelOutboundShipmentTrackingView>,
  addressByUser: Map<string, Address>,
  chargesByBarrel: Map<string, BarrelOutboundShippingChargeView[]>,
  partnersByBarrel: Map<string, OutboundShippingPartnerRecord[]>,
  partnerCatalog: OutboundShippingPartnerRecord[],
  companyRates: OutboundShippingCompanyRateRow[],
  linksByUser: Map<string, AdminCompanyRateLinkGroup[]>,
): AdminShipmentCustomerGroup[] {
  const byUser = new Map<string, AdminChargeSourceRow[]>();
  for (const row of sourceRows) {
    const uid = row.barrel.clerkUserId;
    const list = byUser.get(uid) ?? [];
    list.push(row);
    byUser.set(uid, list);
  }

  const groups: AdminShipmentCustomerGroup[] = [];

  for (const [, userRows] of byUser) {
    const profile = userRows[0]?.profile;
    const aliasMap = buildContainerAliasMap(
      userRows.map((r) => ({
        barrelId: r.barrel.id,
        kind: parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel"),
        createdAt: r.barrel.createdAt,
      })),
    );

    const mapped = userRows.map((r) =>
      mapSingleAdminRow(
        r,
        aliasMap,
        imageByOfferingId,
        trackingByBarrel,
        addressByUser,
        chargesByBarrel,
        partnersByBarrel,
        partnerCatalog,
        companyRates,
      ),
    );
    const rateLinkableContainers = mapped.map(toRateLinkableContainer);
    const companyRateLinks =
      linksByUser.get(userRows[0]!.barrel.clerkUserId) ?? [];
    for (const row of mapped) {
      row.rateLinkableContainers = rateLinkableContainers;
      row.companyRateLinks = companyRateLinks;
    }

    const readyContainers = mapped
      .filter((r) => r.readyForShipping)
      .sort((a, b) => {
        const aAwaiting = a.intakeId.startsWith("awaiting-") ? 1 : 0;
        const bAwaiting = b.intakeId.startsWith("awaiting-") ? 1 : 0;
        if (aAwaiting !== bAwaiting) return aAwaiting - bAwaiting;
        return a.submittedAt.localeCompare(b.submittedAt);
      });

    const notReadyContainers = mapped
      .filter((r) => !r.readyForShipping)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    if (readyContainers.length === 0 && notReadyContainers.length === 0) {
      continue;
    }

    groups.push({
      clerkUserId: userRows[0]!.barrel.clerkUserId,
      customerName: profile?.fullName ?? null,
      customerEmail: profile?.email ?? null,
      readyContainers,
      notReadyContainers,
    });
  }

  groups.sort((a, b) => {
    const nameA = (a.customerName ?? a.customerEmail ?? a.clerkUserId).toLowerCase();
    const nameB = (b.customerName ?? b.customerEmail ?? b.clerkUserId).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return groups;
}

export async function listAdminShipmentChargePageData(
  clerkUserId?: string,
): Promise<AdminShipmentChargePageData> {
  try {
    return await loadAdminShipmentChargePageData(clerkUserId);
  } catch (e) {
    console.error("[listAdminShipmentChargePageData]", e);
    await seedKingdomKleanerzCourierZones().catch(() => undefined);
    await clearStaleCatalogChargeBundleClones().catch(() => undefined);
    const [catalogPartners, companyRates, catalogDefaults] = await Promise.all([
      listOutboundShippingPartnerCatalog().catch(() => []),
      listOutboundShippingCompanyRates().catch(() => []),
      getOutboundShippingCatalogDefaults().catch(() => ({
        chargeBundle: [],
        companyRateKinds: [],
      })),
    ]);
    return {
      customerGroups: [],
      catalogPartners,
      companyRates,
      catalogChargeBundle: catalogDefaults.chargeBundle,
      catalogCompanyRateKinds: catalogDefaults.companyRateKinds,
    };
  }
}

async function loadAdminShipmentChargePageData(
  clerkUserId?: string,
): Promise<AdminShipmentChargePageData> {
  await ensureBarrelShippingIntakesSchema();
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureBarrelOutboundShipmentTrackingSchema();
  await ensureOrderContainerPackagingFeeColumns();
  await clearStaleCatalogChargeBundleClones().catch((e) => {
    console.error("[loadAdminShipmentChargePageData] catalog bundle clones", e);
  });

  let sourceRows: Awaited<ReturnType<typeof loadAllActiveBarrelRows>>;
  try {
    sourceRows = await loadAllActiveBarrelRows(clerkUserId);
  } catch (e) {
    if (
      !isMissingBarrelOutboundShippingChargesTableError(e) &&
      !isMissingOrderContainerPackagingFeeColumnError(e)
    ) {
      throw e;
    }
    if (isMissingOrderContainerPackagingFeeColumnError(e)) {
      await ensureOrderContainerPackagingFeeColumns();
    }
    if (
      isMissingBarrelOutboundShippingChargesTableError(e) &&
      !(await ensureBarrelOutboundShippingChargesSchema())
    ) {
      throw e;
    }
    sourceRows = await loadAllActiveBarrelRows(clerkUserId);
  }

  const ownerIds = [...new Set(sourceRows.map((r) => r.barrel.clerkUserId))];

  const offeringIds = [
    ...new Set(
      sourceRows
        .map((r) => r.oci?.containerOfferingId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const barrelIds = sourceRows.map((r) => r.barrel.id);
  const ownerClerkUserIds = sourceRows.map((r) => r.barrel.clerkUserId);
  const chargesByOwner = new Map<string, string[]>();
  for (const r of sourceRows) {
    const list = chargesByOwner.get(r.barrel.clerkUserId) ?? [];
    list.push(r.barrel.id);
    chargesByOwner.set(r.barrel.clerkUserId, list);
  }

  const [imageByOfferingId, trackingByBarrel, addressByUser, chargeMaps] =
    await Promise.all([
      getPrimaryImageUrlByOfferingIds(offeringIds).catch((e) => {
        console.error("[loadAdminShipmentChargePageData] images", e);
        return new Map<string, string>();
      }),
      getShipmentTrackingByBarrelIds(barrelIds),
      getPrimaryShippingAddressesByClerkUserIds(ownerClerkUserIds).catch(
        (e) => {
          console.error("[loadAdminShipmentChargePageData] addresses", e);
          return new Map();
        },
      ),
      Promise.all(
        [...chargesByOwner.entries()].map(([uid, ids]) =>
          getOutboundShippingChargesByBarrelIds(uid, ids),
        ),
      ),
    ]);

  const chargesByBarrel = new Map<string, BarrelOutboundShippingChargeView[]>();
  for (const map of chargeMaps) {
    for (const [barrelId, charges] of map) {
      chargesByBarrel.set(barrelId, charges);
    }
  }

  const [partnersByBarrel, partnerCatalog, companyRates, catalogDefaults] =
    await Promise.all([
    listOutboundShippingPartnersByBarrelIds(barrelIds).catch((e) => {
      console.error("[loadAdminShipmentChargePageData] partners", e);
      return new Map();
    }),
    listOutboundShippingPartnerCatalog().catch((e) => {
      console.error("[loadAdminShipmentChargePageData] partner catalog", e);
      return [];
    }),
    listOutboundShippingCompanyRates().catch((e) => {
      console.error("[loadAdminShipmentChargePageData] company rates", e);
      return [];
    }),
    getOutboundShippingCatalogDefaults().catch((e) => {
      console.error("[loadAdminShipmentChargePageData] catalog defaults", e);
      return { chargeBundle: [], companyRateKinds: [] };
    }),
  ]);
  const linksByUser = new Map<string, AdminCompanyRateLinkGroup[]>();
  await Promise.all(
    ownerIds.map(async (ownerId) => {
      linksByUser.set(
        ownerId,
        groupCompanyRateLinks(
          await listOutboundShippingCompanyRateLinksForUser(ownerId),
        ),
      );
    }),
  );

  const customerGroups = buildCustomerGroups(
    sourceRows,
    imageByOfferingId,
    trackingByBarrel,
    addressByUser,
    chargesByBarrel,
    partnersByBarrel,
    partnerCatalog,
    companyRates,
    linksByUser,
  );

  return {
    customerGroups,
    catalogPartners: partnerCatalog,
    companyRates,
    catalogChargeBundle: catalogDefaults.chargeBundle,
    catalogCompanyRateKinds: catalogDefaults.companyRateKinds,
  };
}

export async function listAdminBarrelOutboundShippingChargeRows(): Promise<
  AdminBarrelOutboundShippingChargeRow[]
> {
  const { customerGroups } = await listAdminShipmentChargePageData();
  return customerGroups.flatMap((g) =>
    g.readyContainers.filter((r) => !r.intakeId.startsWith("awaiting-")),
  );
}
