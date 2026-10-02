import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let schemaReady = false;

/**
 * Adds cargo-box enum value plus note/dimension columns when Neon is behind
 * `drizzle/0114_container_offering_cargo_box_note.sql`.
 */
export async function ensureContainerOfferingCargoBoxSchema(): Promise<void> {
  if (schemaReady) return;

  const db = getDb();
  try {
    await db.execute(sql`
      ALTER TYPE "public"."container_offering_kind" ADD VALUE IF NOT EXISTS 'cargo_box'
    `);
  } catch (e) {
    console.error("[ensureContainerOfferingCargoBoxSchema] enum", e);
  }

  await db.execute(sql`
    ALTER TABLE "container_offerings"
    ADD COLUMN IF NOT EXISTS "customer_note" text
  `);
  await db.execute(sql`
    ALTER TABLE "container_offerings"
    ADD COLUMN IF NOT EXISTS "dimension_label" text
  `);
  schemaReady = true;
}
