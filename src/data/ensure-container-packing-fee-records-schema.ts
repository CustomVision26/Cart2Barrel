import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let schemaReady = false;

/** Creates packing-fee record table when missing. Idempotent until db:push. */
export async function ensureContainerPackingFeeRecordsSchema(): Promise<boolean> {
  if (schemaReady) return true;
  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "container_packing_fee_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "container_kind" "container_offering_kind" NOT NULL,
        "cargo_box_size" text DEFAULT '' NOT NULL,
        "single_fee_cents" integer NOT NULL,
        "multi_fee_cents" integer NOT NULL,
        "published_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "container_packing_fee_records_kind_size_uidx"
      ON "container_packing_fee_records" ("container_kind", "cargo_box_size")
    `);
    await db.execute(sql`
      INSERT INTO "container_packing_fee_records" (
        "container_kind",
        "cargo_box_size",
        "single_fee_cents",
        "multi_fee_cents",
        "published_at"
      )
      SELECT
        'barrel',
        '',
        COALESCE(s."barrel_shipping_fee_cents", 10000),
        COALESCE(s."multi_barrel_packing_per_unit_cents", 8000),
        now()
      FROM "merchant_packing_fee_settings" s
      WHERE s."singleton_key" = 'default'
        AND NOT EXISTS (
          SELECT 1 FROM "container_packing_fee_records" r
          WHERE r."container_kind" = 'barrel' AND r."cargo_box_size" = ''
        )
    `);
    await db.execute(sql`
      INSERT INTO "container_packing_fee_records" (
        "container_kind",
        "cargo_box_size",
        "single_fee_cents",
        "multi_fee_cents",
        "published_at"
      )
      SELECT
        'bin',
        '',
        COALESCE(s."bin_shipping_fee_cents", 5500),
        COALESCE(s."multi_bin_packing_per_unit_cents", 4500),
        now()
      FROM "merchant_packing_fee_settings" s
      WHERE s."singleton_key" = 'default'
        AND NOT EXISTS (
          SELECT 1 FROM "container_packing_fee_records" r
          WHERE r."container_kind" = 'bin' AND r."cargo_box_size" = ''
        )
    `);
    await db.execute(sql`
      INSERT INTO "container_packing_fee_records" (
        "container_kind",
        "cargo_box_size",
        "single_fee_cents",
        "multi_fee_cents",
        "published_at"
      )
      SELECT 'barrel', '', 10000, 8000, now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "container_packing_fee_records"
        WHERE "container_kind" = 'barrel' AND "cargo_box_size" = ''
      )
    `);
    await db.execute(sql`
      INSERT INTO "container_packing_fee_records" (
        "container_kind",
        "cargo_box_size",
        "single_fee_cents",
        "multi_fee_cents",
        "published_at"
      )
      SELECT 'bin', '', 5500, 4500, now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "container_packing_fee_records"
        WHERE "container_kind" = 'bin' AND "cargo_box_size" = ''
      )
    `);
    schemaReady = true;
    return true;
  } catch {
    return false;
  }
}
