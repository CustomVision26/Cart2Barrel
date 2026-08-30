"use server";

import {
  generateHubStockUsDomesticLabel,
  loadPaidUsHubPackage,
  persistHubStockUsPackageDelivered,
  persistHubStockUsPackageShipped,
  type GenerateHubStockUsLabelResult,
} from "@/data/hub-stock-us-package";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { lookupShippoTrackingStatus } from "@/lib/shippo";
import {
  generateHubStockUsLabelSchema,
  hubStockUsPackageOrderIdSchema,
  shipHubStockUsPackageSchema,
  type GenerateHubStockUsLabelInput,
  type HubStockUsPackageOrderIdInput,
  type ShipHubStockUsPackageInput,
} from "@/lib/validations/admin-hub-stock-shipment";

export type ShipHubStockUsPackageState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type GenerateHubStockUsLabelState = GenerateHubStockUsLabelResult;

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

  await persistHubStockUsPackageShipped({
    order: pack.order,
    lines: eligible,
    carrier: parsed.data.retailerTrackingCompany,
    trackingNumber: parsed.data.retailerTrackingNumber,
    trackingUrl: parsed.data.trackingUrl ?? null,
    updatedByClerkUserId: gate.userId,
    notifyCustomer: true,
  });

  return {
    ok: true,
    message: `Shipment saved. The customer was notified with ${parsed.data.retailerTrackingCompany} tracking ${parsed.data.retailerTrackingNumber}.`,
  };
}

export async function generateHubStockUsLabelAction(
  raw: GenerateHubStockUsLabelInput,
): Promise<GenerateHubStockUsLabelState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = generateHubStockUsLabelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.flatten().fieldErrors.orderId?.[0] ?? "Invalid order.",
    };
  }

  return generateHubStockUsDomesticLabel({
    orderId: parsed.data.orderId,
    staffClerkUserId: gate.userId,
    carrier: parsed.data.carrier,
    service: parsed.data.service,
    cents: parsed.data.cents,
  });
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

  await persistHubStockUsPackageDelivered({
    order: pack.order,
    lines: inTransit,
    updatedByClerkUserId: gate.userId,
  });

  return {
    ok: true,
    message: "Package marked delivered to the customer. They were notified.",
  };
}
