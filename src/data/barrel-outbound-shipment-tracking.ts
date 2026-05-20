import "server-only";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { barrelOutboundShipmentTracking } from "@/db/schema";
import { ensureBarrelOutboundShipmentTrackingSchema } from "@/data/ensure-barrel-outbound-shipment-tracking-schema";
import type { BarrelOutboundShipmentTrackingView } from "@/lib/barrel-shipment-tracking";
import {
  isBarrelShipmentStage,
  type BarrelOutboundShipmentStage,
} from "@/lib/barrel-shipment-tracking";

function mapTrackingRow(
  row: typeof barrelOutboundShipmentTracking.$inferSelect,
): BarrelOutboundShipmentTrackingView {
  const stage = isBarrelShipmentStage(row.trackingStage) ?
    row.trackingStage
  : "awaiting_customs_clearance";

  return {
    barrelId: row.barrelId,
    trackingStage: stage,
    stageUpdatedAt: row.stageUpdatedAt,
    customsDeclarationFormUrl: row.customsDeclarationFormUrl,
    freightCompanyName: row.freightCompanyName,
    freightDropOffAt: row.freightDropOffAt,
    estimatedArrivalAt: row.estimatedArrivalAt,
  };
}

export async function getShipmentTrackingByBarrelIds(
  barrelIds: string[],
): Promise<Map<string, BarrelOutboundShipmentTrackingView>> {
  if (barrelIds.length === 0) {
    return new Map();
  }

  await ensureBarrelOutboundShipmentTrackingSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(barrelOutboundShipmentTracking)
    .where(inArray(barrelOutboundShipmentTracking.barrelId, barrelIds));

  return new Map(rows.map((r) => [r.barrelId, mapTrackingRow(r)] as const));
}

export async function upsertShipmentTrackingOnFreightPaid(input: {
  barrelId: string;
  chargeId: string;
}): Promise<void> {
  await ensureBarrelOutboundShipmentTrackingSchema();
  const db = getDb();
  const now = new Date().toISOString();

  const [existing] = await db
    .select({ id: barrelOutboundShipmentTracking.id })
    .from(barrelOutboundShipmentTracking)
    .where(eq(barrelOutboundShipmentTracking.barrelId, input.barrelId))
    .limit(1);

  if (existing) {
    await db
      .update(barrelOutboundShipmentTracking)
      .set({
        chargeId: input.chargeId,
        trackingStage: "awaiting_customs_clearance",
        stageUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(barrelOutboundShipmentTracking.barrelId, input.barrelId));
    return;
  }

  await db.insert(barrelOutboundShipmentTracking).values({
    barrelId: input.barrelId,
    chargeId: input.chargeId,
    trackingStage: "awaiting_customs_clearance",
    stageUpdatedAt: now,
    updatedAt: now,
  });
}

export async function updateShipmentTrackingStage(
  barrelId: string,
  stage: BarrelOutboundShipmentStage,
): Promise<void> {
  await ensureBarrelOutboundShipmentTrackingSchema();
  const now = new Date().toISOString();
  const db = getDb();
  await db
    .update(barrelOutboundShipmentTracking)
    .set({
      trackingStage: stage,
      stageUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(barrelOutboundShipmentTracking.barrelId, barrelId));
}

async function ensureTrackingRowForBarrel(barrelId: string, chargeId?: string | null) {
  const db = getDb();
  const [existing] = await db
    .select({ id: barrelOutboundShipmentTracking.id })
    .from(barrelOutboundShipmentTracking)
    .where(eq(barrelOutboundShipmentTracking.barrelId, barrelId))
    .limit(1);
  if (existing) {
    return;
  }
  const now = new Date().toISOString();
  await db.insert(barrelOutboundShipmentTracking).values({
    barrelId,
    chargeId: chargeId ?? null,
    trackingStage: "awaiting_customs_clearance",
    stageUpdatedAt: now,
    updatedAt: now,
  });
}

export async function setCustomsDeclarationFormUrl(
  barrelId: string,
  customsDeclarationFormUrl: string,
): Promise<void> {
  await ensureBarrelOutboundShipmentTrackingSchema();
  await ensureTrackingRowForBarrel(barrelId);
  const now = new Date().toISOString();
  const db = getDb();
  await db
    .update(barrelOutboundShipmentTracking)
    .set({
      customsDeclarationFormUrl: customsDeclarationFormUrl.trim(),
      updatedAt: now,
    })
    .where(eq(barrelOutboundShipmentTracking.barrelId, barrelId));
}

export async function saveShipmentCustomsClearance(input: {
  barrelId: string;
  customsDeclarationFormUrl?: string | null;
  freightCompanyName: string;
  freightDropOffAt: string;
  estimatedArrivalAt: string;
  advanceStageAfterSave?: boolean;
}): Promise<void> {
  await ensureBarrelOutboundShipmentTrackingSchema();
  await ensureTrackingRowForBarrel(input.barrelId);
  const now = new Date().toISOString();
  const db = getDb();

  const patch: Partial<typeof barrelOutboundShipmentTracking.$inferInsert> = {
    freightCompanyName: input.freightCompanyName.trim(),
    freightDropOffAt: input.freightDropOffAt,
    estimatedArrivalAt: input.estimatedArrivalAt,
    updatedAt: now,
  };

  if (input.customsDeclarationFormUrl !== undefined) {
    patch.customsDeclarationFormUrl =
      input.customsDeclarationFormUrl?.trim() || null;
  }

  if (input.advanceStageAfterSave) {
    patch.trackingStage = "ready_for_shipment";
    patch.stageUpdatedAt = now;
  }

  await db
    .update(barrelOutboundShipmentTracking)
    .set(patch)
    .where(eq(barrelOutboundShipmentTracking.barrelId, input.barrelId));
}
