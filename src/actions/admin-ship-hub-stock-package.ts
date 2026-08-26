"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import {
  recordHubStockPackageDeliveredActivity,
  recordHubStockPackageShippedActivity,
} from "@/data/user-status-update-events";
import { getDb } from "@/db";
import { hubStockOrderItems, orderItems, orders } from "@/db/schema";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { lookupShippoTrackingStatus } from "@/lib/shippo";
import {
  hubStockUsPackageOrderIdSchema,
  shipHubStockUsPackageSchema,
  type HubStockUsPackageOrderIdInput,
  type ShipHubStockUsPackageInput,
} from "@/lib/validations/admin-hub-stock-shipment";

export type ShipHubStockUsPackageState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateHubStockUsPackagePaths(): void {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidateDashboardAddItem();
}

async function loadPaidUsHubPackage(orderId: string): Promise<
  | {
      ok: true;
      order: { id: string; clerkUserId: string };
      lines: {
        id: string;
        fulfillmentStatus: (typeof orderItems.$inferSelect)["fulfillmentStatus"];
        companyPurchaseRetailerTrackingCompany: string | null;
        companyPurchaseRetailerTrackingNumber: string | null;
      }[];
    }
  | { ok: false; message: string }
> {
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

export async function shipHubStockUsPackageAction(
  raw: ShipHubStockUsPackageInput,
): Promise<ShipHubStockUsPackageState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = shipHubStockUsPackageSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.retailerTrackingCompany?.[0] ??
      flat.retailerTrackingNumber?.[0] ??
      flat.trackingUrl?.[0] ??
      flat.orderId?.[0];
    return { ok: false, message: first ?? "Invalid shipment details." };
  }

  const pack = await loadPaidUsHubPackage(parsed.data.orderId);
  if (!pack.ok) return pack;

  const eligible = pack.lines.filter(
    (line) =>
      line.fulfillmentStatus === "hub_stock_pending_us_shipment" ||
      line.fulfillmentStatus === "hub_stock_us_in_transit",
  );

  if (eligible.length === 0) {
    return {
      ok: false,
      message: "No in-hub US lines are ready to ship on this order.",
    };
  }

  const trackingUrl = parsed.data.trackingUrl ?? null;
  const company = parsed.data.retailerTrackingCompany;
  const trackingNumber = parsed.data.retailerTrackingNumber;
  const db = getDb();

  await db
    .update(orderItems)
    .set({
      fulfillmentStatus: "hub_stock_us_in_transit",
      companyPurchaseTrackingUrl: trackingUrl,
      companyPurchaseRetailerTrackingCompany: company,
      companyPurchaseRetailerTrackingNumber: trackingNumber,
      companyPurchaseUpdatedByClerkUserId: gate.userId,
    })
    .where(
      inArray(
        orderItems.id,
        eligible.map((line) => line.id),
      ),
    );

  await recordHubStockPackageShippedActivity({
    clerkUserId: pack.order.clerkUserId,
    orderId: pack.order.id,
    carrier: company,
    trackingNumber,
    productCount: eligible.length,
  });

  revalidateHubStockUsPackagePaths();

  return {
    ok: true,
    message: `Shipment saved. The customer was notified with ${company} tracking ${trackingNumber}.`,
  };
}

export async function checkHubStockUsPackageTrackingAction(
  raw: HubStockUsPackageOrderIdInput,
): Promise<ShipHubStockUsPackageState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = hubStockUsPackageOrderIdSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.flatten().fieldErrors.orderId?.[0] ?? "Invalid order." };
  }

  const pack = await loadPaidUsHubPackage(parsed.data.orderId);
  if (!pack.ok) return pack;

  const inTransit = pack.lines.filter(
    (line) => line.fulfillmentStatus === "hub_stock_us_in_transit",
  );
  if (inTransit.length === 0) {
    return {
      ok: false,
      message: "This warehouse package is not in transit.",
    };
  }

  const seeded =
    inTransit.find((line) => line.companyPurchaseRetailerTrackingNumber?.trim()) ??
    inTransit[0]!;
  const carrier = seeded.companyPurchaseRetailerTrackingCompany?.trim() ?? "";
  const trackingNumber = seeded.companyPurchaseRetailerTrackingNumber?.trim() ?? "";
  if (!carrier || !trackingNumber) {
    return {
      ok: false,
      message: "Save a carrier and tracking number before checking delivery.",
    };
  }

  const lookup = await lookupShippoTrackingStatus({ carrier, trackingNumber });
  if (!lookup.ok) return lookup;
  if (lookup.skipped) {
    return { ok: true, message: lookup.message };
  }

  const detail = lookup.statusDetails ? ` — ${lookup.statusDetails}` : "";
  if (lookup.delivered) {
    return {
      ok: true,
      message: `${carrier} reports this package delivered${detail}. Click Next to mark it arrived at the customer.`,
    };
  }

  const status = lookup.status.replace(/_/g, " ").toLowerCase();
  return {
    ok: true,
    message: `${carrier} currently shows ${status}${detail}. Click Next only after the carrier shows delivered.`,
  };
}

export async function markHubStockUsPackageDeliveredAction(
  raw: HubStockUsPackageOrderIdInput,
): Promise<ShipHubStockUsPackageState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = hubStockUsPackageOrderIdSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.flatten().fieldErrors.orderId?.[0] ?? "Invalid order." };
  }

  const pack = await loadPaidUsHubPackage(parsed.data.orderId);
  if (!pack.ok) return pack;

  const inTransit = pack.lines.filter(
    (line) => line.fulfillmentStatus === "hub_stock_us_in_transit",
  );
  if (inTransit.length === 0) {
    return {
      ok: false,
      message: "No in-hub US package is in transit on this order.",
    };
  }

  const seeded =
    inTransit.find((line) => line.companyPurchaseRetailerTrackingNumber?.trim()) ??
    inTransit[0]!;
  const db = getDb();

  await db
    .update(orderItems)
    .set({
      fulfillmentStatus: "hub_stock_us_delivered",
      companyPurchaseUpdatedByClerkUserId: gate.userId,
    })
    .where(
      inArray(
        orderItems.id,
        inTransit.map((line) => line.id),
      ),
    );

  await recordHubStockPackageDeliveredActivity({
    clerkUserId: pack.order.clerkUserId,
    orderId: pack.order.id,
    carrier: seeded.companyPurchaseRetailerTrackingCompany,
    trackingNumber: seeded.companyPurchaseRetailerTrackingNumber,
    productCount: inTransit.length,
  });

  revalidateHubStockUsPackagePaths();

  return {
    ok: true,
    message: "Package marked delivered to the customer. They were notified.",
  };
}
