import "server-only";

import { eq, inArray } from "drizzle-orm";

import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { getDb } from "@/db";
import { hubStockOrderItems, hubStockProducts, orderItems } from "@/db/schema";
import {
  formatHubStockBoxSize,
  shippoDashboardHref,
  type HubStockOrderPackingPackage,
} from "@/lib/hub-stock-box";
import { hubStockUsShipToKey } from "@/lib/hub-stock";
import {
  combineHubStockParcels,
  hubStockParcelFromProduct,
} from "@/lib/hub-stock-parcel";

export type { HubStockOrderPackingPackage };

function shippingLabelForPackage(
  carrier: string | null,
  service: string | null,
): string | null {
  const label = [carrier, service]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return label || null;
}

/**
 * Groups paid in-hub lines per order into the same warehouse packages used at
 * checkout, with the outer box size staff should pack.
 */
export async function listHubStockOrderPackingByOrderIds(
  orderIds: string[],
): Promise<Map<string, HubStockOrderPackingPackage[]>> {
  const map = new Map<string, HubStockOrderPackingPackage[]>();
  if (orderIds.length === 0) return map;

  await ensureHubStockSchemaEnums();

  const db = getDb();
  const rows = await db
    .select({
      orderId: hubStockOrderItems.orderId,
      destination: hubStockOrderItems.destination,
      quantity: hubStockOrderItems.quantity,
      nameSnapshot: hubStockOrderItems.nameSnapshot,
      sizeSnapshot: hubStockOrderItems.sizeSnapshot,
      colorSnapshot: hubStockOrderItems.colorSnapshot,
      shipLine1: hubStockOrderItems.shipLine1,
      shipLine2: hubStockOrderItems.shipLine2,
      shipCity: hubStockOrderItems.shipCity,
      shipState: hubStockOrderItems.shipState,
      shipPostalCode: hubStockOrderItems.shipPostalCode,
      shippingCarrier: hubStockOrderItems.shippingCarrier,
      shippingService: hubStockOrderItems.shippingService,
      snapWeightOz: hubStockOrderItems.parcelWeightOz,
      snapLengthIn: hubStockOrderItems.parcelLengthIn,
      snapWidthIn: hubStockOrderItems.parcelWidthIn,
      snapHeightIn: hubStockOrderItems.parcelHeightIn,
      liveWeightOz: hubStockProducts.parcelWeightOz,
      liveLengthIn: hubStockProducts.parcelLengthIn,
      liveWidthIn: hubStockProducts.parcelWidthIn,
      liveHeightIn: hubStockProducts.parcelHeightIn,
      shippoLabelUrl: hubStockOrderItems.shippoLabelUrl,
      fulfillmentStatus: orderItems.fulfillmentStatus,
    })
    .from(hubStockOrderItems)
    .leftJoin(hubStockProducts, eq(hubStockOrderItems.productId, hubStockProducts.id))
    .innerJoin(orderItems, eq(orderItems.id, hubStockOrderItems.orderItemId))
    .where(inArray(hubStockOrderItems.orderId, orderIds));

  const byOrder = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byOrder.get(row.orderId) ?? [];
    list.push(row);
    byOrder.set(row.orderId, list);
  }

  for (const [orderId, orderRows] of byOrder) {
    const usGroups = new Map<string, typeof orderRows>();
    const overseas: typeof orderRows = [];
    for (const row of orderRows) {
      if (row.destination !== "us_address") {
        overseas.push(row);
        continue;
      }
      const key =
        hubStockUsShipToKey({
          destination: row.destination,
          shipLine1: row.shipLine1,
          shipLine2: row.shipLine2,
          shipCity: row.shipCity,
          shipState: row.shipState,
          shipPostalCode: row.shipPostalCode,
        }) ?? `incomplete:${orderId}:${row.nameSnapshot}`;
      const group = usGroups.get(key) ?? [];
      group.push(row);
      usGroups.set(key, group);
    }

    const packages: HubStockOrderPackingPackage[] = [];
    let usIndex = 0;
    for (const [key, group] of usGroups) {
      usIndex += 1;
      packages.push(toPackingPackage(`us:${key}`, "us_address", group, usIndex));
    }
    if (overseas.length > 0) {
      packages.push(toPackingPackage("overseas", "overseas_container", overseas, 0));
    }
    map.set(orderId, packages);
  }

  return map;
}

function toPackingPackage(
  key: string,
  destination: HubStockOrderPackingPackage["destination"],
  group: {
    quantity: number;
    nameSnapshot: string;
    sizeSnapshot: string;
    colorSnapshot: string;
    shippingCarrier: string | null;
    shippingService: string | null;
    snapWeightOz: number | null;
    snapLengthIn: number | null;
    snapWidthIn: number | null;
    snapHeightIn: number | null;
    liveWeightOz: number | null;
    liveLengthIn: number | null;
    liveWidthIn: number | null;
    liveHeightIn: number | null;
    shippoLabelUrl: string | null;
    fulfillmentStatus: (typeof orderItems.$inferSelect)["fulfillmentStatus"];
  }[],
  usIndex: number,
): HubStockOrderPackingPackage {
  const parcels = group
    .map((row) => {
      const parcel =
        hubStockParcelFromProduct({
          parcelWeightOz: row.snapWeightOz,
          parcelLengthIn: row.snapLengthIn,
          parcelWidthIn: row.snapWidthIn,
          parcelHeightIn: row.snapHeightIn,
        }) ??
        hubStockParcelFromProduct({
          parcelWeightOz: row.liveWeightOz,
          parcelLengthIn: row.liveLengthIn,
          parcelWidthIn: row.liveWidthIn,
          parcelHeightIn: row.liveHeightIn,
        });
      if (!parcel) return null;
      return { parcel, quantity: row.quantity };
    })
    .filter((row): row is { parcel: NonNullable<ReturnType<typeof hubStockParcelFromProduct>>; quantity: number } =>
      row != null,
    );
  const combined =
    destination === "us_address" ? combineHubStockParcels(parcels) : null;
  const box = combined ? formatHubStockBoxSize(combined) : null;
  const rated = group.find((row) => row.shippingCarrier || row.shippingService);
  const unitCount = group.reduce((sum, row) => sum + row.quantity, 0);
  const productLabels = group.map((row) => {
    const variant = [row.sizeSnapshot, row.colorSnapshot]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" · ");
    return variant ? `${row.nameSnapshot} (${variant})` : row.nameSnapshot;
  });

  return {
    key: usIndex > 1 ? `${key}:${usIndex}` : key,
    destination,
    itemCount: group.length,
    unitCount,
    productLabels,
    boxType: box?.boxType ?? null,
    boxSizeLabel: box?.boxSizeLabel ?? null,
    shippingLabel: shippingLabelForPackage(
      rated?.shippingCarrier ?? null,
      rated?.shippingService ?? null,
    ),
    canGenerateLabel:
      destination === "us_address" &&
      group.some(
        (row) =>
          row.fulfillmentStatus === "hub_stock_pending_us_shipment" ||
          row.fulfillmentStatus === "hub_stock_us_in_transit",
      ),
    shippoLabelUrl:
      group.map((row) => row.shippoLabelUrl?.trim()).find(Boolean) ?? null,
    shippoDashboardUrl: shippoDashboardHref(),
  };
}
