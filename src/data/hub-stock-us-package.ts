import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { listShippingAddressesForUser } from "@/data/addresses";
import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { isHubShipFromComplete, loadHubShipFromSettings } from "@/data/hub-ship-from";
import { persistHubStockReturnReceived } from "@/data/hub-stock-us-return";
import {
  recordHubStockPackageDeliveredActivity,
  recordHubStockPackageShippedActivity,
} from "@/data/user-status-update-events";
import { getDb } from "@/db";
import {
  hubStockOrderItems,
  hubStockProducts,
  orderItems,
  orders,
} from "@/db/schema";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import {
  combineHubStockParcels,
  hubStockParcelFromProduct,
} from "@/lib/hub-stock-parcel";
import {
  isCompareShippingCarrier,
  listShippoUsdRates,
  purchaseShippoDomesticLabel,
  type ShippoQuotedRate,
} from "@/lib/shippo";

export type HubStockUsPackageLine = {
  id: string;
  fulfillmentStatus: (typeof orderItems.$inferSelect)["fulfillmentStatus"];
  companyPurchaseRetailerTrackingCompany: string | null;
  companyPurchaseRetailerTrackingNumber: string | null;
};

export type LoadedPaidUsHubPackage =
  | {
      ok: true;
      order: { id: string; clerkUserId: string };
      lines: HubStockUsPackageLine[];
    }
  | { ok: false; message: string };

export type HubStockLabelRateOption = {
  cents: number;
  carrier: string;
  service: string;
  estimatedDays: number | null;
  durationTerms: string | null;
};

export type GenerateHubStockUsLabelResult =
  | { ok: true; message: string; labelUrl: string | null }
  | {
      ok: false;
      message: string;
      rates?: HubStockLabelRateOption[];
    };

function revalidateHubStockUsPackagePaths(): void {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidateDashboardAddItem();
}

function rateKey(carrier: string, service: string): string {
  return `${carrier.trim().toLowerCase()}|${service.trim().toLowerCase()}`;
}

function toPublicRate(rate: ShippoQuotedRate): HubStockLabelRateOption {
  return {
    cents: rate.cents,
    carrier: rate.carrier,
    service: rate.service,
    estimatedDays: rate.estimatedDays,
    durationTerms: rate.durationTerms,
  };
}

function findMatchingRate(
  rates: ShippoQuotedRate[],
  wanted: { carrier: string; service: string; cents?: number },
): ShippoQuotedRate | null {
  const key = rateKey(wanted.carrier, wanted.service);
  const same = rates.filter((rate) => rateKey(rate.carrier, rate.service) === key);
  if (same.length === 0) return null;
  if (wanted.cents != null) {
    const centsMatch = same.find((rate) => rate.cents === wanted.cents);
    if (centsMatch) return centsMatch;
  }
  return same[0] ?? null;
}

function trackingLookupKey(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export async function loadPaidUsHubPackage(
  orderId: string,
): Promise<LoadedPaidUsHubPackage> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      clerkUserId: orders.clerkUserId,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.status !== "paid") {
    return { ok: false, message: "Paid order not found." };
  }

  const hubRows = await db
    .select({
      orderItemId: hubStockOrderItems.orderItemId,
      destination: hubStockOrderItems.destination,
    })
    .from(hubStockOrderItems)
    .where(eq(hubStockOrderItems.orderId, order.id));

  const usItemIds = hubRows
    .filter((row) => row.destination === "us_address")
    .map((row) => row.orderItemId);

  if (usItemIds.length === 0) {
    return { ok: false, message: "This order has no US in-hub warehouse package." };
  }

  const lines = await db
    .select({
      id: orderItems.id,
      fulfillmentStatus: orderItems.fulfillmentStatus,
      companyPurchaseRetailerTrackingCompany:
        orderItems.companyPurchaseRetailerTrackingCompany,
      companyPurchaseRetailerTrackingNumber:
        orderItems.companyPurchaseRetailerTrackingNumber,
    })
    .from(orderItems)
    .where(
      and(eq(orderItems.orderId, order.id), inArray(orderItems.id, usItemIds)),
    );

  return {
    ok: true,
    order: { id: order.id, clerkUserId: order.clerkUserId },
    lines,
  };
}

function eligibleUsShipLines(lines: HubStockUsPackageLine[]): HubStockUsPackageLine[] {
  return lines.filter(
    (line) =>
      line.fulfillmentStatus === "hub_stock_pending_us_shipment" ||
      line.fulfillmentStatus === "hub_stock_us_in_transit",
  );
}

export async function persistHubStockUsPackageShipped(input: {
  order: { id: string; clerkUserId: string };
  lines: HubStockUsPackageLine[];
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  updatedByClerkUserId: string | null;
  shippo?: {
    transactionId: string | null;
    labelUrl: string | null;
    trackingStatus: string | null;
    trackingStatusDetails: string | null;
  };
  notifyCustomer: boolean;
}): Promise<void> {
  const db = getDb();
  const lineIds = input.lines.map((line) => line.id);
  const now = new Date().toISOString();

  await db
    .update(orderItems)
    .set({
      fulfillmentStatus: "hub_stock_us_in_transit",
      companyPurchaseTrackingUrl: input.trackingUrl,
      companyPurchaseRetailerTrackingCompany: input.carrier,
      companyPurchaseRetailerTrackingNumber: input.trackingNumber,
      companyPurchaseUpdatedByClerkUserId: input.updatedByClerkUserId,
    })
    .where(inArray(orderItems.id, lineIds));

  if (input.shippo) {
    await db
      .update(hubStockOrderItems)
      .set({
        shippoTransactionId: input.shippo.transactionId,
        shippoLabelUrl: input.shippo.labelUrl,
        trackingStatus: input.shippo.trackingStatus,
        trackingStatusDetails: input.shippo.trackingStatusDetails,
        trackingUpdatedAt: now,
      })
      .where(inArray(hubStockOrderItems.orderItemId, lineIds));
  }

  if (input.notifyCustomer) {
    await recordHubStockPackageShippedActivity({
      clerkUserId: input.order.clerkUserId,
      orderId: input.order.id,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      productCount: input.lines.length,
    });
  }

  revalidateHubStockUsPackagePaths();
}

export async function persistHubStockUsPackageDelivered(input: {
  order: { id: string; clerkUserId: string };
  lines: HubStockUsPackageLine[];
  updatedByClerkUserId?: string | null;
}): Promise<{ notified: boolean }> {
  const inTransit = input.lines.filter(
    (line) => line.fulfillmentStatus === "hub_stock_us_in_transit",
  );
  if (inTransit.length === 0) {
    return { notified: false };
  }

  const seeded =
    inTransit.find((line) => line.companyPurchaseRetailerTrackingNumber?.trim()) ??
    inTransit[0]!;
  const db = getDb();

  await db
    .update(orderItems)
    .set(
      input.updatedByClerkUserId === undefined ?
        { fulfillmentStatus: "hub_stock_us_delivered" }
      : {
          fulfillmentStatus: "hub_stock_us_delivered",
          companyPurchaseUpdatedByClerkUserId: input.updatedByClerkUserId,
        },
    )
    .where(
      inArray(
        orderItems.id,
        inTransit.map((line) => line.id),
      ),
    );

  await recordHubStockPackageDeliveredActivity({
    clerkUserId: input.order.clerkUserId,
    orderId: input.order.id,
    carrier: seeded.companyPurchaseRetailerTrackingCompany,
    trackingNumber: seeded.companyPurchaseRetailerTrackingNumber,
    productCount: inTransit.length,
  });

  revalidateHubStockUsPackagePaths();
  return { notified: true };
}

export async function generateHubStockUsDomesticLabel(input: {
  orderId: string;
  staffClerkUserId: string;
  carrier?: string;
  service?: string;
  cents?: number;
}): Promise<GenerateHubStockUsLabelResult> {
  const pack = await loadPaidUsHubPackage(input.orderId);
  if (!pack.ok) return pack;

  const eligible = eligibleUsShipLines(pack.lines);
  if (eligible.length === 0) {
    return {
      ok: false,
      message: "No in-hub US lines are ready for a shipping label on this order.",
    };
  }

  const db = getDb();
  const hubRows = await db
    .select({
      orderItemId: hubStockOrderItems.orderItemId,
      destination: hubStockOrderItems.destination,
      quantity: hubStockOrderItems.quantity,
      nameSnapshot: hubStockOrderItems.nameSnapshot,
      shipLine1: hubStockOrderItems.shipLine1,
      shipLine2: hubStockOrderItems.shipLine2,
      shipCity: hubStockOrderItems.shipCity,
      shipState: hubStockOrderItems.shipState,
      shipPostalCode: hubStockOrderItems.shipPostalCode,
      shippingCents: hubStockOrderItems.shippingCents,
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
    })
    .from(hubStockOrderItems)
    .leftJoin(hubStockProducts, eq(hubStockOrderItems.productId, hubStockProducts.id))
    .where(eq(hubStockOrderItems.orderId, pack.order.id));

  const usRows = hubRows.filter(
    (row) =>
      row.destination === "us_address" &&
      eligible.some((line) => line.id === row.orderItemId),
  );
  const sample = usRows[0];
  if (!sample) {
    return { ok: false, message: "This order has no US in-hub warehouse package." };
  }
  if (
    !sample.shipLine1?.trim() ||
    !sample.shipCity?.trim() ||
    !sample.shipState?.trim() ||
    !sample.shipPostalCode?.trim()
  ) {
    return {
      ok: false,
      message: "This warehouse package is missing the destination US address.",
    };
  }

  const parcels = usRows
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
    .filter(
      (row): row is { parcel: NonNullable<ReturnType<typeof hubStockParcelFromProduct>>; quantity: number } =>
        row != null,
    );
  const combined = combineHubStockParcels(parcels);
  if (!combined) {
    return {
      ok: false,
      message:
        "Package weight and size are required to buy a label. Add them on the in-hub catalog SKU.",
    };
  }

  const from = await loadHubShipFromSettings();
  if (!isHubShipFromComplete(from)) {
    return {
      ok: false,
      message:
        "The hub ship-from address is incomplete. Save a primary US warehouse address on In-hub products.",
    };
  }

  const addresses = await listShippingAddressesForUser(pack.order.clerkUserId);
  const zipDigits = sample.shipPostalCode.replace(/\D/g, "");
  const matchedAddress = addresses.find((row) => {
    const sameStreet = row.line1.trim().toLowerCase() === sample.shipLine1!.trim().toLowerCase();
    const sameZip = (row.postalCode ?? "").replace(/\D/g, "") === zipDigits;
    return sameStreet && sameZip;
  });

  const listed = await listShippoUsdRates({
    from: {
      name: from.name,
      phone: from.phone,
      street1: from.line1,
      street2: from.line2,
      city: from.city,
      state: from.state,
      zip: from.postalCode,
      country: "US",
    },
    to: {
      name: matchedAddress?.recipientName?.trim() || "Customer",
      phone: matchedAddress?.recipientPhone?.trim() || from.phone,
      street1: sample.shipLine1.trim(),
      street2: sample.shipLine2,
      city: sample.shipCity.trim(),
      state: sample.shipState.trim(),
      zip: sample.shipPostalCode.trim(),
      country: "US",
    },
    parcel: combined,
  });
  if (!listed.ok) return listed;

  const compare = listed.rates.filter(
    (rate) => isCompareShippingCarrier(rate.carrier) && rate.objectId,
  );
  const rates = compare.length > 0 ? compare : listed.rates.filter((rate) => rate.objectId);
  if (rates.length === 0) {
    return {
      ok: false,
      message: "Shippo did not return a purchasable US shipping rate for this package.",
    };
  }

  const rated = usRows.find((row) => row.shippingCarrier || row.shippingService);
  const wantedCarrier = input.carrier?.trim() || rated?.shippingCarrier?.trim() || "";
  const wantedService = input.service?.trim() || rated?.shippingService?.trim() || "";
  const wantedCents = input.cents ?? rated?.shippingCents ?? undefined;

  const match =
    wantedCarrier && wantedService ?
      findMatchingRate(rates, {
        carrier: wantedCarrier,
        service: wantedService,
        cents: wantedCents,
      })
    : null;

  if (!match) {
    return {
      ok: false,
      message:
        wantedCarrier && wantedService ?
          `Shippo no longer lists ${wantedCarrier} ${wantedService}. Pick a current rate, or enter tracking manually.`
        : "Pick the shipping rate to buy for this warehouse package.",
      rates: rates.map(toPublicRate),
    };
  }

  const purchased = await purchaseShippoDomesticLabel({
    rateObjectId: match.objectId,
    metadata: `order:${pack.order.id}`,
  });
  if (!purchased.ok) return purchased;

  const alreadyInTransit = eligible.every(
    (line) => line.fulfillmentStatus === "hub_stock_us_in_transit",
  );
  const sameTracking = eligible.every(
    (line) =>
      trackingLookupKey(line.companyPurchaseRetailerTrackingNumber ?? "") ===
      trackingLookupKey(purchased.label.trackingNumber),
  );
  const notifyCustomer = !(alreadyInTransit && sameTracking);

  await persistHubStockUsPackageShipped({
    order: pack.order,
    lines: eligible,
    carrier: match.carrier,
    trackingNumber: purchased.label.trackingNumber,
    trackingUrl: purchased.label.trackingUrl,
    updatedByClerkUserId: input.staffClerkUserId,
    shippo: {
      transactionId: purchased.label.transactionId,
      labelUrl: purchased.label.labelUrl,
      trackingStatus: purchased.label.trackingStatus,
      trackingStatusDetails: null,
    },
    notifyCustomer,
  });

  return {
    ok: true,
    message: `Label purchased. Tracking ${purchased.label.trackingNumber} (${purchased.label.carrier}).`,
    labelUrl: purchased.label.labelUrl,
  };
}

export async function applyShippoTrackUpdated(input: {
  trackingNumber: string;
  transactionId?: string | null;
  status: string | null;
  statusDetails: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
}): Promise<{ ok: true; applied: boolean } | { ok: false; message: string }> {
  await ensureHubStockSchemaEnums();
  const trackingNumber = input.trackingNumber.trim();
  if (!trackingNumber) {
    return { ok: false, message: "Missing tracking number." };
  }

  const db = getDb();
  const lookup = trackingLookupKey(trackingNumber);
  const transactionId = input.transactionId?.trim() || "";

  const candidates = await db
    .select({
      orderItemId: hubStockOrderItems.orderItemId,
      orderId: hubStockOrderItems.orderId,
      shippoTransactionId: hubStockOrderItems.shippoTransactionId,
      shippoReturnTransactionId: hubStockOrderItems.shippoReturnTransactionId,
      trackingStatus: hubStockOrderItems.trackingStatus,
      trackingNumber: orderItems.companyPurchaseRetailerTrackingNumber,
      fulfillmentStatus: orderItems.fulfillmentStatus,
      clerkUserId: orders.clerkUserId,
      companyPurchaseRetailerTrackingCompany:
        orderItems.companyPurchaseRetailerTrackingCompany,
      companyPurchaseTrackingUrl: orderItems.companyPurchaseTrackingUrl,
    })
    .from(hubStockOrderItems)
    .innerJoin(orderItems, eq(orderItems.id, hubStockOrderItems.orderItemId))
    .innerJoin(orders, eq(orders.id, hubStockOrderItems.orderId))
    .where(
      and(
        eq(hubStockOrderItems.destination, "us_address"),
        eq(orders.status, "paid"),
        or(
          transactionId ?
            eq(hubStockOrderItems.shippoTransactionId, transactionId)
          : sql`false`,
          transactionId ?
            eq(hubStockOrderItems.shippoReturnTransactionId, transactionId)
          : sql`false`,
          sql`${orderItems.companyPurchaseRetailerTrackingNumber} IS NOT NULL
            AND regexp_replace(upper(${orderItems.companyPurchaseRetailerTrackingNumber}), '\\s+', '', 'g') = ${lookup}`,
        ),
      ),
    );

  if (candidates.length === 0) {
    return { ok: true, applied: false };
  }

  const orderIds = [...new Set(candidates.map((row) => row.orderId))];
  const now = new Date().toISOString();
  const status = input.status?.trim() || null;
  const statusDetails = input.statusDetails?.trim() || null;
  const delivered = (status ?? "").toUpperCase() === "DELIVERED";

  for (const orderId of orderIds) {
    const rows = candidates.filter((row) => row.orderId === orderId);
    const lineIds = rows.map((row) => row.orderItemId);
    const [first] = rows;
    if (!first) continue;

    if (delivered) {
      const returnRows = rows.filter(
        (row) => row.fulfillmentStatus === "product_return_awaiting_delivery",
      );
      const outboundRows = rows.filter(
        (row) => row.fulfillmentStatus === "hub_stock_us_in_transit",
      );
      if (returnRows.length > 0) {
        await persistHubStockReturnReceived({
          orderItemIds: returnRows.map((row) => row.orderItemId),
          clerkUserId: first.clerkUserId,
          orderId,
        });
      }
      if (outboundRows.length > 0) {
        await persistHubStockUsPackageDelivered({
          order: { id: orderId, clerkUserId: first.clerkUserId },
          lines: outboundRows.map((row) => ({
            id: row.orderItemId,
            fulfillmentStatus: row.fulfillmentStatus,
            companyPurchaseRetailerTrackingCompany:
              row.companyPurchaseRetailerTrackingCompany,
            companyPurchaseRetailerTrackingNumber: row.trackingNumber,
          })),
        });
      }
    }

    await db
      .update(hubStockOrderItems)
      .set({
        trackingStatus: status,
        trackingStatusDetails: statusDetails,
        trackingUpdatedAt: now,
      })
      .where(inArray(hubStockOrderItems.orderItemId, lineIds));

    if (input.trackingUrl?.trim() && !first.companyPurchaseTrackingUrl?.trim()) {
      await db
        .update(orderItems)
        .set({
          companyPurchaseTrackingUrl: input.trackingUrl.trim(),
        })
        .where(inArray(orderItems.id, lineIds));
    }

    revalidateHubStockUsPackagePaths();
  }

  return { ok: true, applied: true };
}
