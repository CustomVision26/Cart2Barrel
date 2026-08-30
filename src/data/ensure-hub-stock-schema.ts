import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { isLikelyOrderFulfillmentEnumInQueryFailure } from "@/lib/db-column-missing";

let attempted = false;
let available = false;

/** Adds hub-stock enum values when missing (idempotent). */
export async function ensureHubStockSchemaEnums(): Promise<boolean> {
  if (attempted) return available;
  attempted = true;

  const db = getDb();
  try {
    await db.execute(sql`
      ALTER TYPE "public"."item_request_source"
      ADD VALUE IF NOT EXISTS 'hub_stock'
    `);
    await db.execute(sql`
      ALTER TYPE "public"."order_item_fulfillment_status"
      ADD VALUE IF NOT EXISTS 'hub_stock_pending_us_shipment'
    `);
    await db.execute(sql`
      ALTER TYPE "public"."order_item_fulfillment_status"
      ADD VALUE IF NOT EXISTS 'hub_stock_pending_container'
    `);
    await db.execute(sql`
      ALTER TYPE "public"."order_item_fulfillment_status"
      ADD VALUE IF NOT EXISTS 'hub_stock_us_in_transit'
    `);
    await db.execute(sql`
      ALTER TYPE "public"."order_item_fulfillment_status"
      ADD VALUE IF NOT EXISTS 'hub_stock_us_delivered'
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_products"
      ADD COLUMN IF NOT EXISTS "parcel_weight_oz" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_products"
      ADD COLUMN IF NOT EXISTS "parcel_length_in" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_products"
      ADD COLUMN IF NOT EXISTS "parcel_width_in" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_products"
      ADD COLUMN IF NOT EXISTS "parcel_height_in" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_cart_items"
      ADD COLUMN IF NOT EXISTS "shipping_cents" integer NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_cart_items"
      ADD COLUMN IF NOT EXISTS "shipping_carrier" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_cart_items"
      ADD COLUMN IF NOT EXISTS "shipping_service" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "shipping_cents" integer NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "shipping_carrier" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "shipping_service" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "parcel_weight_oz" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "parcel_length_in" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "parcel_width_in" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "parcel_height_in" double precision
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "shippo_transaction_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "shippo_label_url" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "tracking_status" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "tracking_status_details" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "tracking_updated_at" timestamp with time zone
    `);
    await db.execute(sql`
      ALTER TYPE "public"."order_item_fulfillment_status"
      ADD VALUE IF NOT EXISTS 'hub_stock_return_requested'
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "shippo_return_transaction_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "hub_stock_order_items"
      ADD COLUMN IF NOT EXISTS "shippo_return_label_url" text
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "hub_ship_from_settings" (
        "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
        "name" text,
        "phone" text,
        "line1" text,
        "line2" text,
        "city" text,
        "state" text,
        "postal_code" text,
        "country" text DEFAULT 'United States' NOT NULL,
        "updated_by_clerk_user_id" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "hub_ship_from_addresses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "phone" text NOT NULL,
        "line1" text NOT NULL,
        "line2" text,
        "city" text NOT NULL,
        "state" text NOT NULL,
        "postal_code" text NOT NULL,
        "country" text DEFAULT 'United States' NOT NULL,
        "is_primary" boolean DEFAULT false NOT NULL,
        "updated_by_clerk_user_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "hub_ship_from_addresses_is_primary_idx"
      ON "hub_ship_from_addresses" ("is_primary")
    `);
    available = true;
    return true;
  } catch (e) {
    const low = String(e).toLowerCase();
    if (low.includes("already exists")) {
      available = true;
      return true;
    }
    if (isLikelyOrderFulfillmentEnumInQueryFailure(e)) {
      available = false;
      return false;
    }
    throw e;
  }
}
