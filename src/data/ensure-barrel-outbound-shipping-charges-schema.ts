import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let schemaReady = false;

/**
 * Creates outbound shipping charge tables when missing.
 * Idempotent until `npm run db:push` / migrate has run.
 */
export async function ensureBarrelOutboundShippingChargesSchema(): Promise<boolean> {
  if (schemaReady) {
    return true;
  }

  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_charges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "barrel_id" uuid NOT NULL,
        "clerk_user_id" text NOT NULL,
        "admin_note" text,
        "paid_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_charge_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "charge_id" uuid NOT NULL,
        "label" text NOT NULL,
        "amount_cents" integer NOT NULL,
        "sort_index" integer DEFAULT 0 NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_outbound_shipping_cart_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clerk_user_id" text NOT NULL,
        "charge_id" uuid NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_outbound_shipping_charges"
          ADD CONSTRAINT "barrel_outbound_shipping_charges_barrel_id_barrels_id_fk"
          FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_outbound_shipping_charges"
          ADD CONSTRAINT "barrel_outbound_shipping_charges_clerk_user_id_profiles_clerk_user_id_fk"
          FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_outbound_shipping_charge_lines"
          ADD CONSTRAINT "barrel_outbound_shipping_charge_lines_charge_id_fk"
          FOREIGN KEY ("charge_id") REFERENCES "public"."barrel_outbound_shipping_charges"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "user_outbound_shipping_cart_lines"
          ADD CONSTRAINT "user_outbound_shipping_cart_lines_clerk_user_id_fk"
          FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "user_outbound_shipping_cart_lines"
          ADD CONSTRAINT "user_outbound_shipping_cart_lines_charge_id_fk"
          FOREIGN KEY ("charge_id") REFERENCES "public"."barrel_outbound_shipping_charges"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipping_charges_barrel_unique"
      ON "barrel_outbound_shipping_charges" USING btree ("barrel_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_charges_clerk_user_id_idx"
      ON "barrel_outbound_shipping_charges" USING btree ("clerk_user_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_charge_lines_charge_id_idx"
      ON "barrel_outbound_shipping_charge_lines" USING btree ("charge_id")
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_outbound_shipping_cart_lines_user_charge_unique"
      ON "user_outbound_shipping_cart_lines" USING btree ("clerk_user_id", "charge_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "user_outbound_shipping_cart_lines_clerk_user_id_idx"
      ON "user_outbound_shipping_cart_lines" USING btree ("clerk_user_id")
    `);

    schemaReady = true;
    return true;
  } catch {
    schemaReady = false;
    return false;
  }
}
