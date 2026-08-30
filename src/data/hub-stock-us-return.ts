import "server-only";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { listShippingAddressesForUser } from "@/data/addresses";
import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { isHubShipFromComplete, loadHubShipFromSettings } from "@/data/hub-ship-from";
import { getHubStockOrderItemByOrderItemId } from "@/data/hub-stock-cart";
import { restoreHubStockQty } from "@/data/hub-stock-products";
import { getItemRequestById } from "@/data/item-requests";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { getProductReturnRequestByOrderItemId } from "@/data/order-item-product-return-requests";
import {
  recordHubStockReturnReceivedActivity,
  recordProductReturnFulfilledActivity,
} from "@/data/user-status-update-events";
import { getDb } from "@/db";
import {
  hubStockOrderItems,
  hubStockProducts,
  itemRequestLineSnapshots,
  orderItemProductReturnRequests,
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
import {
  buildProductReturnTrackingAuditMemo,
  productReturnTrackingHumanNote,
} from "@/lib/product-return-tracking-memo";
import { defaultProductReturnStaffCustomerNote } from "@/lib/product-return-staff-customer-note";
import { PRODUCT_RETURN_AWAITING_REFUND_LABEL } from "@/lib/product-return-request-labels";

export type HubStockReturnRateOption = {
  cents: number;
  carrier: string;
  service: string;
  estimatedDays: number | null;
  durationTerms: string | null;
};

export type GenerateHubStockUsReturnLabelResult =
  | { ok: true; message: string; labelUrl: string | null }
  | { ok: false; message: string; rates?: HubStockReturnRateOption[] };

function revalidateReturnPaths(): void {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidateDashboardAddItem();
}

function rateKey(carrier: string, service: string): string {
  return `${carrier.trim().toLowerCase()}|${service.trim().toLowerCase()}`;
}

function toPublicRate(rate: ShippoQuotedRate): HubStockReturnRateOption {
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

export async function generateHubStockUsReturnLabel(input: {
  orderItemId: string;
  staffClerkUserId: string;
  customerNotes: string;
  carrier?: string;
  service?: string;
  cents?: number;
}): Promise<GenerateHubStockUsReturnLabelResult> {
  await ensureHubStockSchemaEnums();
  const db = getDb();

  const [scoped] = await db
    .select({
      orderItemId: orderItems.id,
      itemRequestId: orderItems.itemRequestId,
      fulfillmentStatus: orderItems.fulfillmentStatus,
      orderId: orders.id,
      clerkUserId: orders.clerkUserId,
      orderStatus: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.id, input.orderItemId))
    .limit(1);

  if (!scoped || scoped.orderStatus !== "paid") {
    return { ok: false, message: "Order line not found." };
  }
  if (scoped.fulfillmentStatus !== "hub_stock_return_requested") {
    return {
      ok: false,
      message: "Generate a return label after the customer submits a return request.",
    };
  }

  const returnRequest = await getProductReturnRequestByOrderItemId(scoped.orderItemId);
  if (!returnRequest || returnRequest.status !== "submitted") {
    return { ok: false, message: "No pending product return request for this line." };
  }

  const [hubRow] = await db
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
    .where(eq(hubStockOrderItems.orderItemId, scoped.orderItemId))
    .limit(1);

  if (!hubRow || hubRow.destination !== "us_address") {
    return { ok: false, message: "This line is not a US in-hub warehouse product." };
  }
  if (
    !hubRow.shipLine1?.trim() ||
    !hubRow.shipCity?.trim() ||
    !hubRow.shipState?.trim() ||
    !hubRow.shipPostalCode?.trim()
  ) {
    return {
      ok: false,
      message: "This product is missing the customer US address for a return label.",
    };
  }

  const parcel =
    hubStockParcelFromProduct({
      parcelWeightOz: hubRow.snapWeightOz,
      parcelLengthIn: hubRow.snapLengthIn,
      parcelWidthIn: hubRow.snapWidthIn,
      parcelHeightIn: hubRow.snapHeightIn,
    }) ??
    hubStockParcelFromProduct({
      parcelWeightOz: hubRow.liveWeightOz,
      parcelLengthIn: hubRow.liveLengthIn,
      parcelWidthIn: hubRow.liveWidthIn,
      parcelHeightIn: hubRow.liveHeightIn,
    });
  const combined = parcel
    ? combineHubStockParcels([{ parcel, quantity: hubRow.quantity }])
    : null;
  if (!combined) {
    return {
      ok: false,
      message: "Package weight and size are required to buy a return label.",
    };
  }

  const hubFrom = await loadHubShipFromSettings();
  if (!isHubShipFromComplete(hubFrom)) {
    return {
      ok: false,
      message:
        "Save a primary US warehouse address on In-hub products before buying a return label.",
    };
  }

  const addresses = await listShippingAddressesForUser(scoped.clerkUserId);
  const zipDigits = hubRow.shipPostalCode.replace(/\D/g, "");
  const matchedAddress = addresses.find((row) => {
    const sameStreet =
      row.line1.trim().toLowerCase() === hubRow.shipLine1!.trim().toLowerCase();
    const sameZip = (row.postalCode ?? "").replace(/\D/g, "") === zipDigits;
    return sameStreet && sameZip;
  });

  const listed = await listShippoUsdRates({
    from: {
      name: matchedAddress?.recipientName?.trim() || "Customer",
      phone: matchedAddress?.recipientPhone?.trim() || hubFrom.phone,
      street1: hubRow.shipLine1.trim(),
      street2: hubRow.shipLine2,
      city: hubRow.shipCity.trim(),
      state: hubRow.shipState.trim(),
      zip: hubRow.shipPostalCode.trim(),
      country: "US",
    },
    to: {
      name: hubFrom.name,
      phone: hubFrom.phone,
      street1: hubFrom.line1,
      street2: hubFrom.line2,
      city: hubFrom.city,
      state: hubFrom.state,
      zip: hubFrom.postalCode,
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
    return { ok: false, message: "Shippo did not return a purchasable return rate." };
  }

  const wantedCarrier = input.carrier?.trim() ?? "";
  const wantedService = input.service?.trim() ?? "";
  const match =
    wantedCarrier && wantedService ?
      findMatchingRate(rates, {
        carrier: wantedCarrier,
        service: wantedService,
        cents: input.cents,
      })
    : null;

  if (!match) {
    return {
      ok: false,
      message:
        "Pick a USPS, UPS, or FedEx rate for the customer to ship this product back to the warehouse.",
      rates: rates.map(toPublicRate),
    };
  }

  const purchased = await purchaseShippoDomesticLabel({
    rateObjectId: match.objectId,
    metadata: `return:${scoped.orderId}:${scoped.orderItemId}`,
  });
  if (!purchased.ok) return purchased;

  const customerNotes =
    input.customerNotes.trim() ||
    defaultProductReturnStaffCustomerNote(returnRequest.desiredOutcome, "hub_stock_us");
  const now = new Date().toISOString();

  await db
    .update(orderItems)
    .set({
      companyPurchaseTrackingUrl: purchased.label.trackingUrl,
      companyPurchaseRetailerTrackingCompany: match.carrier,
      companyPurchaseRetailerTrackingNumber: purchased.label.trackingNumber,
      fulfillmentStatus: "product_return_awaiting_delivery",
      companyPurchaseUpdatedByClerkUserId: input.staffClerkUserId,
    })
    .where(eq(orderItems.id, scoped.orderItemId));

  await db
    .update(hubStockOrderItems)
    .set({
      shippoReturnTransactionId: purchased.label.transactionId,
      shippoReturnLabelUrl: purchased.label.labelUrl,
      trackingStatus: purchased.label.trackingStatus,
      trackingStatusDetails: null,
      trackingUpdatedAt: now,
    })
    .where(eq(hubStockOrderItems.orderItemId, scoped.orderItemId));

  await db
    .update(orderItemProductReturnRequests)
    .set({
      status: "fulfilled",
      customerNotes,
      fulfilledAt: now,
      fulfilledByClerkUserId: input.staffClerkUserId,
      updatedAt: now,
    })
    .where(eq(orderItemProductReturnRequests.id, returnRequest.id));

  const req = await getItemRequestById(scoped.itemRequestId);
  if (req) {
    const payload = lineSnapshotPayloadFromItemRequest(req);
    try {
      await db.insert(itemRequestLineSnapshots).values({
        itemRequestId: scoped.itemRequestId,
        phase: "product_return_tracking_saved",
        itemQuoteId: null,
        batchQuoteSessionId: null,
        auditMemo: buildProductReturnTrackingAuditMemo({
          orderItemId: scoped.orderItemId,
          trackingUrl: purchased.label.trackingUrl ?? undefined,
          retailerTrackingCompany: match.carrier,
          retailerTrackingNumber: purchased.label.trackingNumber,
        }),
        productUrl: payload.productUrl,
        productName: payload.productName,
        productSize: payload.productSize,
        productColor: payload.productColor,
        quantity: payload.quantity,
        note: productReturnTrackingHumanNote({
          desiredOutcome: returnRequest.desiredOutcome,
          trackingUrl: purchased.label.trackingUrl,
          retailerTrackingCompany: match.carrier,
          retailerTrackingNumber: purchased.label.trackingNumber,
        }),
        productImageUrl: payload.productImageUrl,
        siteName: payload.siteName,
      });
    } catch {
      /* phase enum may lag */
    }
  }

  await recordProductReturnFulfilledActivity({
    clerkUserId: scoped.clerkUserId,
    orderId: scoped.orderId,
    orderItemId: scoped.orderItemId,
    productName: req?.productName ?? hubRow.nameSnapshot,
  });

  revalidateReturnPaths();

  return {
    ok: true,
    message:
      returnRequest.desiredOutcome === "money_back" ?
        `Return label purchased. Tracking ${purchased.label.trackingNumber}. Status is ${PRODUCT_RETURN_AWAITING_REFUND_LABEL}.`
      : `Return label purchased. Tracking ${purchased.label.trackingNumber}. The customer can print the label from Orders.`,
    labelUrl: purchased.label.labelUrl,
  };
}

export async function persistHubStockReturnReceived(input: {
  orderItemIds: string[];
  clerkUserId: string;
  orderId: string;
}): Promise<{ notified: boolean }> {
  if (input.orderItemIds.length === 0) return { notified: false };
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const lines = await db
    .select({
      id: orderItems.id,
      fulfillmentStatus: orderItems.fulfillmentStatus,
    })
    .from(orderItems)
    .where(inArray(orderItems.id, input.orderItemIds));

  const awaiting = lines.filter(
    (line) => line.fulfillmentStatus === "product_return_awaiting_delivery",
  );
  if (awaiting.length === 0) return { notified: false };

  const awaitingIds = awaiting.map((line) => line.id);
  const hubRows = await db
    .select({
      orderItemId: hubStockOrderItems.orderItemId,
      productId: hubStockOrderItems.productId,
      quantity: hubStockOrderItems.quantity,
      trackingStatus: hubStockOrderItems.trackingStatus,
      nameSnapshot: hubStockOrderItems.nameSnapshot,
    })
    .from(hubStockOrderItems)
    .where(inArray(hubStockOrderItems.orderItemId, awaitingIds));

  const toReceive = hubRows.filter(
    (row) => (row.trackingStatus ?? "").toUpperCase() !== "DELIVERED",
  );
  if (toReceive.length === 0) {
    return { notified: false };
  }

  const receiveIds = toReceive.map((row) => row.orderItemId);
  const now = new Date().toISOString();
  await db
    .update(hubStockOrderItems)
    .set({
      trackingStatus: "DELIVERED",
      trackingStatusDetails: "Returned to warehouse",
      trackingUpdatedAt: now,
    })
    .where(inArray(hubStockOrderItems.orderItemId, receiveIds));

  for (const row of toReceive) {
    if (row.productId) {
      await restoreHubStockQty(row.productId, row.quantity);
    }
  }

  await recordHubStockReturnReceivedActivity({
    clerkUserId: input.clerkUserId,
    orderId: input.orderId,
    productCount: toReceive.length,
    productName: toReceive[0]?.nameSnapshot ?? null,
  });

  revalidateReturnPaths();
  return { notified: true };
}

export async function markHubStockUsReturnReceived(orderItemId: string): Promise<
  { ok: true; message: string } | { ok: false; message: string }
> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const [scoped] = await db
    .select({
      id: orderItems.id,
      fulfillmentStatus: orderItems.fulfillmentStatus,
      orderId: orders.id,
      clerkUserId: orders.clerkUserId,
      status: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!scoped || scoped.status !== "paid") {
    return { ok: false, message: "Order line not found." };
  }
  if (scoped.fulfillmentStatus !== "product_return_awaiting_delivery") {
    return { ok: false, message: "This return is not awaiting warehouse receipt." };
  }
  const hub = await getHubStockOrderItemByOrderItemId(scoped.id);
  if (!hub || hub.destination !== "us_address") {
    return { ok: false, message: "This is not a US in-hub return." };
  }

  const result = await persistHubStockReturnReceived({
    orderItemIds: [scoped.id],
    clerkUserId: scoped.clerkUserId,
    orderId: scoped.orderId,
  });
  if (!result.notified) {
    return { ok: true, message: "Warehouse receipt was already recorded for this return." };
  }
  return {
    ok: true,
    message:
      "Return marked received at the warehouse. The customer was notified and stock was restored.",
  };
}
