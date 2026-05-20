import "server-only";

import { and, asc, eq, inArray, notInArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrelShippingIntakes,
  barrels,
  orderContainerItems,
  profiles,
} from "@/db/schema";
import { getShipmentTrackingByBarrelIds } from "@/data/barrel-outbound-shipment-tracking";
import { getPrimaryImageUrlByOfferingIds } from "@/data/container-offerings";
import { ensureBarrelOutboundShipmentTrackingSchema } from "@/data/ensure-barrel-outbound-shipment-tracking-schema";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import { isContainerReadyForShippingIntake } from "@/lib/barrel-shipping-intake";
import type {
  AdminBarrelOutboundShippingChargeRow,
  AdminShipmentChargePageData,
  AdminShipmentCustomerGroup,
} from "@/lib/barrel-outbound-shipping-charge";
import { sumChargeLineCents } from "@/lib/barrel-outbound-shipping-charge";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import { buildContainerAliasMap } from "@/lib/container-slot-alias";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";

async function loadChargeLinesByChargeId(
  chargeIds: string[],
): Promise<Map<string, { label: string; amountCents: number }[]>> {
  if (chargeIds.length === 0) {
    return new Map();
  }
  const db = getDb();
  const rows = await db
    .select({
      chargeId: barrelOutboundShippingChargeLines.chargeId,
      label: barrelOutboundShippingChargeLines.label,
      amountCents: barrelOutboundShippingChargeLines.amountCents,
    })
    .from(barrelOutboundShippingChargeLines)
    .where(inArray(barrelOutboundShippingChargeLines.chargeId, chargeIds))
    .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));

  const map = new Map<string, { label: string; amountCents: number }[]>();
  for (const row of rows) {
    const list = map.get(row.chargeId) ?? [];
    list.push({ label: row.label, amountCents: row.amountCents });
    map.set(row.chargeId, list);
  }
  return map;
}

async function loadAllActiveBarrelRows() {
  const db = getDb();
  return db
    .select({
      barrel: barrels,
      oci: orderContainerItems,
      profile: profiles,
      intake: barrelShippingIntakes,
      charge: barrelOutboundShippingCharges,
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
    .leftJoin(
      barrelOutboundShippingCharges,
      eq(barrelOutboundShippingCharges.barrelId, barrels.id),
    )
    .where(notInArray(barrels.status, ["shipped", "delivered"]))
    .orderBy(asc(profiles.fullName), asc(barrels.createdAt));
}

type AdminChargeSourceRow = {
  barrel: typeof barrels.$inferSelect;
  oci: typeof orderContainerItems.$inferSelect | null;
  profile: typeof profiles.$inferSelect | null;
  intake: typeof barrelShippingIntakes.$inferSelect | null;
  charge: typeof barrelOutboundShippingCharges.$inferSelect | null;
};

function mapSingleAdminRow(
  r: AdminChargeSourceRow,
  aliasMap: Map<string, string>,
  imageByOfferingId: Map<string, string>,
  trackingByBarrel: Map<string, import("@/lib/barrel-shipment-tracking").BarrelOutboundShipmentTrackingView>,
  linesByCharge?: Map<string, { label: string; amountCents: number }[]>,
): AdminBarrelOutboundShippingChargeRow {
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
  const chargeId = r.charge?.id ?? null;
  const lines = chargeId && linesByCharge ? (linesByCharge.get(chargeId) ?? []) : [];
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
    submittedAt: r.intake?.createdAt ?? r.barrel.createdAt,
    chargeId,
    adminNote: r.charge?.adminNote ?? null,
    lines,
    totalCents: sumChargeLineCents(lines),
    paidAt: r.charge?.paidAt ?? null,
    paymentReferenceNumber: r.charge?.paymentReferenceNumber ?? null,
    shipmentTracking: trackingByBarrel.get(r.barrel.id) ?? null,
  };
}

function buildCustomerGroups(
  sourceRows: AdminChargeSourceRow[],
  imageByOfferingId: Map<string, string>,
  trackingByBarrel: Map<string, import("@/lib/barrel-shipment-tracking").BarrelOutboundShipmentTrackingView>,
  linesByCharge: Map<string, { label: string; amountCents: number }[]>,
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
      mapSingleAdminRow(r, aliasMap, imageByOfferingId, trackingByBarrel, linesByCharge),
    );

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

export async function listAdminShipmentChargePageData(): Promise<AdminShipmentChargePageData> {
  await ensureBarrelShippingIntakesSchema();
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureBarrelOutboundShipmentTrackingSchema();

  let sourceRows: Awaited<ReturnType<typeof loadAllActiveBarrelRows>>;
  try {
    sourceRows = await loadAllActiveBarrelRows();
  } catch (e) {
    if (!isMissingBarrelOutboundShippingChargesTableError(e)) {
      throw e;
    }
    if (!(await ensureBarrelOutboundShippingChargesSchema())) {
      throw e;
    }
    sourceRows = await loadAllActiveBarrelRows();
  }

  const offeringIds = [
    ...new Set(
      sourceRows
        .map((r) => r.oci?.containerOfferingId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const chargeIds = sourceRows
    .map((r) => r.charge?.id)
    .filter((id): id is string => id != null);

  const barrelIds = sourceRows.map((r) => r.barrel.id);
  const [imageByOfferingId, linesByCharge, trackingByBarrel] = await Promise.all([
    getPrimaryImageUrlByOfferingIds(offeringIds),
    loadChargeLinesByChargeId(chargeIds),
    getShipmentTrackingByBarrelIds(barrelIds),
  ]);

  const customerGroups = buildCustomerGroups(
    sourceRows,
    imageByOfferingId,
    trackingByBarrel,
    linesByCharge,
  );

  return { customerGroups };
}

export async function listAdminBarrelOutboundShippingChargeRows(): Promise<
  AdminBarrelOutboundShippingChargeRow[]
> {
  const { customerGroups } = await listAdminShipmentChargePageData();
  return customerGroups.flatMap((g) =>
    g.readyContainers.filter((r) => !r.intakeId.startsWith("awaiting-")),
  );
}
