import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";

let trackingSchemaReady = false;

export async function ensureBarrelOutboundShipmentTrackingSchema(): Promise<boolean> {
  if (trackingSchemaReady) {
    return true;
  }

  const chargesOk = await ensureBarrelOutboundShippingChargesSchema();
  if (!chargesOk) {
    return false;
  }

  const db = getDb();
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."barrel_outbound_shipment_stage" AS ENUM(
          'awaiting_customs_clearance',
          'ready_for_shipment',
          'picked_up',
          'at_shipping_warehouse',
          'on_vessel',
          'arrived_destination',
          'customs_processing',
          'cleared_customs',
          'delivered'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "payment_reference_number" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "paid_order_id" uuid
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "barrel_outbound_shipment_tracking" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "barrel_id" uuid NOT NULL,
        "charge_id" uuid,
        "tracking_stage" "barrel_outbound_shipment_stage" DEFAULT 'awaiting_customs_clearance' NOT NULL,
        "stage_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "customs_declaration_form_url" text,
        "freight_company_name" text,
        "freight_drop_off_at" timestamp with time zone,
        "estimated_arrival_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipment_tracking_barrel_unique"
      ON "barrel_outbound_shipment_tracking" USING btree ("barrel_id")
    `);

    trackingSchemaReady = true;
    return true;
  } catch {
    trackingSchemaReady = false;
    return false;
  }
}
