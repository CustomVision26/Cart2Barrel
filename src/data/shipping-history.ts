import "server-only";

import { eq, sql } from "drizzle-orm";

import { getPrimaryShippingAddressesByClerkUserIds } from "@/data/addresses";
import { getBarrelContentsByBarrelIds } from "@/data/barrel-contents";
import { getOutboundShippingChargesByBarrelIds } from "@/data/barrel-outbound-shipping-charges";
import { getPrimaryImageUrlByOfferingIds } from "@/data/container-offerings";
import {
  ensureOrderContainerPackagingFeeColumns,
  orderContainerItemSnapshotColumns,
} from "@/data/ensure-order-container-packaging-fee-schema";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import { getDb } from "@/db";
import {
  barrelShippingIntakes,
  barrels,
  orderContainerItems,
  profiles,
} from "@/db/schema";
import type { ShippingHistoryRow } from "@/lib/barrel-shipping-history";
import {
  applyOutboundChargeBundleForCustomer,
  paidOutboundCharges,
  type BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  barrelShipmentStageIndex,
} from "@/lib/barrel-shipment-tracking";
import { buildContainerAliasMap } from "@/lib/container-slot-alias";
import type { ShippingHistoryQuery } from "@/lib/shipping-history-params";
import { barrelShippingDeliveryMethodSchema } from "@/lib/validations/barrel-shipping-intake";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";

function latestIso(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (!latest || trimmed > latest) latest = trimmed;
  }
  return latest;
}

function searchHaystack(row: ShippingHistoryRow): string {
  const parts = [
    row.alias,
    row.slotLabel,
    row.containerName,
    row.status,
    row.destinationCountry,
    row.customerName,
    row.customerEmail,
    row.shipmentTracking
      ? BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[row.shipmentTracking.trackingStage]
      : "",
    row.shipmentTracking?.freightCompanyName,
    ...row.outboundCharges.flatMap((charge) => [
      charge.partnerName,
      charge.partnerLocation,
      charge.partnerAddress,
      charge.partnerCountry,
      charge.partnerPhone,
      charge.paymentReferenceNumber,
    ]),
  ];
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

function compareHistoryRows(
  a: ShippingHistoryRow,
  b: ShippingHistoryRow,
  sort: ShippingHistoryQuery["sort"],
): number {
  switch (sort) {
    case "shipped_asc":
      return a.historyAt.localeCompare(b.historyAt);
    case "name_az":
      return a.containerName.localeCompare(b.containerName, undefined, {
        sensitivity: "base",
      });
    case "name_za":
      return b.containerName.localeCompare(a.containerName, undefined, {
        sensitivity: "base",
      });
    case "status_az": {
      const aLabel =
        a.shipmentTracking
          ? BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[a.shipmentTracking.trackingStage]
          : a.status;
      const bLabel =
        b.shipmentTracking
          ? BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[b.shipmentTracking.trackingStage]
          : b.status;
      return aLabel.localeCompare(bLabel, undefined, { sensitivity: "base" });
    }
    case "freight_az": {
      const aName =
        a.outboundCharges.find((charge) => charge.chargeKind === "freight")
          ?.partnerName ?? "";
      const bName =
        b.outboundCharges.find((charge) => charge.chargeKind === "freight")
          ?.partnerName ?? "";
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    }
    case "customer_az":
      return (a.customerName || a.customerEmail || "").localeCompare(
        b.customerName || b.customerEmail || "",
        undefined,
        { sensitivity: "base" },
      );
    case "customer_za":
      return (b.customerName || b.customerEmail || "").localeCompare(
        a.customerName || a.customerEmail || "",
        undefined,
        { sensitivity: "base" },
      );
    case "shipped_desc":
    default:
      return b.historyAt.localeCompare(a.historyAt);
  }
}

function groupIdsByOwner(
  rows: Array<{ clerkUserId: string; barrelId: string }>,
): Map<string, string[]> {
  const byOwner = new Map<string, string[]>();
  for (const row of rows) {
    const list = byOwner.get(row.clerkUserId) ?? [];
    list.push(row.barrelId);
    byOwner.set(row.clerkUserId, list);
  }
  return byOwner;
}

async function mergeMapsByOwner<T>(
  byOwner: Map<string, string[]>,
  load: (clerkUserId: string, ids: string[]) => Promise<Map<string, T>>,
): Promise<Map<string, T>> {
  const maps = await Promise.all(
    [...byOwner.entries()].map(([uid, ids]) => load(uid, ids)),
  );
  const merged = new Map<string, T>();
  for (const map of maps) {
    for (const [key, value] of map) {
      merged.set(key, value);
    }
  }
  return merged;
}

function aliasMapGroupedByOwner(
  barrelRows: Array<{
    barrel: { id: string; clerkUserId: string; createdAt: string };
    oci: { kindSnapshot: string | null } | null;
  }>,
): Map<string, string> {
  const byOwner = new Map<string, typeof barrelRows>();
  for (const row of barrelRows) {
    const list = byOwner.get(row.barrel.clerkUserId) ?? [];
    list.push(row);
    byOwner.set(row.barrel.clerkUserId, list);
  }
  const map = new Map<string, string>();
  for (const ownerRows of byOwner.values()) {
    const ownerMap = buildContainerAliasMap(
      ownerRows.map((row) => ({
        barrelId: row.barrel.id,
        kind: parseContainerOfferingKind(row.oci?.kindSnapshot ?? "barrel"),
        createdAt: row.barrel.createdAt,
      })),
    );
    for (const [id, alias] of ownerMap) map.set(id, alias);
  }
  return map;
}

export async function listUserShippingHistory(
  clerkUserId: string,
  query: ShippingHistoryQuery,
): Promise<{ rows: ShippingHistoryRow[]; total: number }> {
  try {
    return await loadShippingHistory({ clerkUserId, query });
  } catch (e) {
    console.error("[listUserShippingHistory]", e);
    return { rows: [], total: 0 };
  }
}

export async function listAdminShippingHistory(
  filterClerkUserId: string | undefined,
  query: ShippingHistoryQuery,
): Promise<{ rows: ShippingHistoryRow[]; total: number }> {
  try {
    return await loadShippingHistory({
      clerkUserId: filterClerkUserId,
      query,
    });
  } catch (e) {
    console.error("[listAdminShippingHistory]", e);
    return { rows: [], total: 0 };
  }
}

async function loadShippingHistory(opts: {
  clerkUserId?: string;
  query: ShippingHistoryQuery;
}): Promise<{ rows: ShippingHistoryRow[]; total: number }> {
  const { clerkUserId, query } = opts;
  await ensureBarrelShippingIntakesSchema();
  await ensureOrderContainerPackagingFeeColumns();
  const db = getDb();

  const barrelRows = await db
    .select({
      barrel: barrels,
      oci: orderContainerItemSnapshotColumns,
      intake: barrelShippingIntakes,
      customerName: profiles.fullName,
      customerEmail: profiles.email,
    })
    .from(barrels)
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .leftJoin(
      barrelShippingIntakes,
      eq(barrelShippingIntakes.barrelId, barrels.id),
    )
    .leftJoin(profiles, eq(profiles.clerkUserId, barrels.clerkUserId))
    .where(
      clerkUserId ? eq(barrels.clerkUserId, clerkUserId) : sql`true`,
    );

  if (barrelRows.length === 0) {
    return { rows: [], total: 0 };
  }

  const offeringIds = [
    ...new Set(
      barrelRows
        .map((row) => row.oci?.containerOfferingId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const ownerIds = [...new Set(barrelRows.map((row) => row.barrel.clerkUserId))];
  const [chargesByBarrel, imageByOfferingId, addressByUser] = await Promise.all([
    mergeMapsByOwner(
      groupIdsByOwner(
        barrelRows.map((row) => ({
          clerkUserId: row.barrel.clerkUserId,
          barrelId: row.barrel.id,
        })),
      ),
      getOutboundShippingChargesByBarrelIds,
    ).catch((e) => {
      console.error("[loadShippingHistory] charges", e);
      return new Map<string, BarrelOutboundShippingChargeView[]>();
    }),
    getPrimaryImageUrlByOfferingIds(offeringIds).catch((e) => {
      console.error("[loadShippingHistory] offering images", e);
      return new Map<string, string>();
    }),
    getPrimaryShippingAddressesByClerkUserIds(ownerIds).catch((e) => {
      console.error("[loadShippingHistory] destination addresses", e);
      return new Map();
    }),
  ]);

  const aliasMap = aliasMapGroupedByOwner(barrelRows);

  const allRows: ShippingHistoryRow[] = [];
  for (const row of barrelRows) {
    const charges = applyOutboundChargeBundleForCustomer(
      chargesByBarrel.get(row.barrel.id) ?? [],
    );
    const paid = paidOutboundCharges(charges);
    const tracking = charges[0]?.shipmentTracking ?? null;
    const trackingIndex = tracking
      ? barrelShipmentStageIndex(tracking.trackingStage)
      : -1;
    const shippedStatus =
      row.barrel.status === "shipped" || row.barrel.status === "delivered";
    const leftWarehouse = trackingIndex >= barrelShipmentStageIndex("picked_up");
    if (paid.length === 0 && !shippedStatus && !leftWarehouse) {
      continue;
    }

    const kind = parseContainerOfferingKind(row.oci?.kindSnapshot ?? "barrel");
    const alias =
      aliasMap.get(row.barrel.id) ?? (kind === "barrel" ? "Barrel" : "Bin");
    const oci = row.oci;
    const slotLabel =
      oci
        ? formatBarrelSlotLabel({
            nameSnapshot: oci.nameSnapshot,
            sizeSnapshot: oci.sizeSnapshot,
            unitOrdinal: row.barrel.unitOrdinal,
          })
        : `Container ${row.barrel.id.slice(0, 8)}…`;
    const containerName = oci?.nameSnapshot.trim() || alias;
    const offeringId = oci?.containerOfferingId ?? null;
    const historyAt =
      latestIso([
        ...paid.map((charge) => charge.paidAt),
        tracking?.stageUpdatedAt,
        row.intake?.createdAt,
        row.barrel.createdAt,
      ]) ?? row.barrel.createdAt;

    const deliveryParsed = barrelShippingDeliveryMethodSchema.safeParse(
      row.intake?.deliveryMethod,
    );
    const destinationCountry =
      paid.find((charge) => charge.partnerCountry?.trim())?.partnerCountry ??
      addressByUser.get(row.barrel.clerkUserId)?.country?.trim() ??
      null;

    allRows.push({
      barrelId: row.barrel.id,
      clerkUserId: row.barrel.clerkUserId,
      customerName: row.customerName?.trim() || null,
      customerEmail: row.customerEmail?.trim() || null,
      alias,
      slotLabel,
      containerName,
      containerImageUrl:
        offeringId ? (imageByOfferingId.get(offeringId) ?? null) : null,
      kind,
      status: row.barrel.status,
      historyAt,
      deliveryMethod: deliveryParsed.success ? deliveryParsed.data : null,
      selectedBrokerKey: row.intake?.selectedBrokerKey ?? null,
      selectedCourierKey: row.intake?.selectedCourierKey ?? null,
      destinationCountry,
      outboundCharges: charges,
      shipmentTracking: tracking,
      contents: [],
    });
  }

  const needle = query.q.trim().toLowerCase();
  const filtered =
    needle.length === 0
      ? allRows
      : allRows.filter((row) => searchHaystack(row).includes(needle));
  filtered.sort((a, b) => compareHistoryRows(a, b, query.sort));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.ps));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.ps;
  const pageRows = filtered.slice(start, start + query.ps);
  const contentsByBarrel =
    pageRows.length === 0
      ? new Map()
      : await mergeMapsByOwner(
          groupIdsByOwner(
            pageRows.map((row) => ({
              clerkUserId: row.clerkUserId,
              barrelId: row.barrelId,
            })),
          ),
          getBarrelContentsByBarrelIds,
        ).catch((e) => {
          console.error("[loadShippingHistory] contents", e);
          return new Map();
        });

  return {
    total,
    rows: pageRows.map((row) => ({
      ...row,
      contents: contentsByBarrel.get(row.barrelId) ?? [],
    })),
  };
}
