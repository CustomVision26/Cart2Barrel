import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let schemaReady = false;

/**
 * Creates `barrel_shipping_intakes` and `barrel_shipping_delivery_method` when missing.
 * Idempotent — safe on every cold start until `npm run db:push` / migrate has run.
 */
export async function ensureBarrelShippingIntakesSchema(): Promise<boolean> {
  if (schemaReady) {
    return true;
  }

  const db = getDb();
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."barrel_shipping_delivery_method" AS ENUM(
          'customs_pickup',
          'broker_delivery'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "barrel_shipping_intakes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "barrel_id" uuid NOT NULL,
        "clerk_user_id" text NOT NULL,
        "delivery_method" "barrel_shipping_delivery_method" NOT NULL,
        "delivery_address_id" uuid,
        "contact_phone" text,
        "special_instructions" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_shipping_intakes"
          ADD CONSTRAINT "barrel_shipping_intakes_barrel_id_barrels_id_fk"
          FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_shipping_intakes"
          ADD CONSTRAINT "barrel_shipping_intakes_clerk_user_id_profiles_clerk_user_id_fk"
          FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_shipping_intakes"
          ADD CONSTRAINT "barrel_shipping_intakes_delivery_address_id_addresses_id_fk"
          FOREIGN KEY ("delivery_address_id") REFERENCES "public"."addresses"("id")
          ON DELETE set null ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "barrel_shipping_intakes_barrel_unique"
      ON "barrel_shipping_intakes" USING btree ("barrel_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "barrel_shipping_intakes_clerk_user_id_idx"
      ON "barrel_shipping_intakes" USING btree ("clerk_user_id")
    `);

    schemaReady = true;
    return true;
  } catch {
    schemaReady = false;
    return false;
  }
}
