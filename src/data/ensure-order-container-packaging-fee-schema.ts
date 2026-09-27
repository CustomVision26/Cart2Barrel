import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { orderContainerItems } from "@/db/schema";

let schemaReady = false;

/**
 * Adds packing-fee columns from migration `0103` when production has not run it yet.
 */
export async function ensureOrderContainerPackagingFeeColumns(): Promise<boolean> {
  if (schemaReady) return true;
  const db = getDb();
  try {
    await db.execute(sql`
      ALTER TABLE "order_container_items"
      ADD COLUMN IF NOT EXISTS "packaging_fee_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_container_items"
      ADD COLUMN IF NOT EXISTS "packaging_per_unit_cents" integer DEFAULT 0 NOT NULL
    `);
    schemaReady = true;
    return true;
  } catch (e) {
    console.error("[ensureOrderContainerPackagingFeeColumns]", e);
    schemaReady = false;
    return false;
  }
}

/** Snapshot fields shipping pages need — does not select packing-fee columns. */
export const orderContainerItemSnapshotColumns = {
  id: orderContainerItems.id,
  containerOfferingId: orderContainerItems.containerOfferingId,
  nameSnapshot: orderContainerItems.nameSnapshot,
  sizeSnapshot: orderContainerItems.sizeSnapshot,
  kindSnapshot: orderContainerItems.kindSnapshot,
};

export type OrderContainerItemSnapshot = {
  id: string;
  containerOfferingId: string | null;
  nameSnapshot: string;
  sizeSnapshot: string;
  kindSnapshot: string;
};
