/**
 * Idempotent schema for purchase merchandise reconciliation.
 * Run: npm run db:ensure-merchandise-reconciliation
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  DO $$ BEGIN
    CREATE TYPE "public"."order_item_merchandise_reconciliation_status" AS ENUM(
      'recorded',
      'customer_notified',
      'topup_pending',
      'topup_paid',
      'matched',
      'cancelled'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'merchandise_price_change'`;
await sql`ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'merchandise_topup_required'`;

await sql`
  CREATE TABLE IF NOT EXISTS "order_item_merchandise_reconciliations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_item_id" uuid NOT NULL,
    "clerk_user_id" text NOT NULL,
    "checkout_merchandise_cents" integer NOT NULL,
    "checkout_shipping_cents" integer DEFAULT 0 NOT NULL,
    "checkout_tax_cents" integer DEFAULT 0 NOT NULL,
    "checkout_service_cents" integer DEFAULT 0 NOT NULL,
    "actual_merchandise_cents" integer NOT NULL,
    "actual_shipping_cents" integer DEFAULT 0 NOT NULL,
    "actual_tax_cents" integer DEFAULT 0 NOT NULL,
    "actual_service_cents" integer DEFAULT 0 NOT NULL,
    "delta_cents" integer NOT NULL,
    "status" "order_item_merchandise_reconciliation_status" NOT NULL,
    "support_ticket_id" uuid,
    "customer_message" text,
    "topup_amount_cents" integer,
    "topup_expires_at" timestamp with time zone,
    "topup_paid_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "created_by_clerk_user_id" text NOT NULL,
    "updated_by_clerk_user_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "checkout_shipping_cents" integer DEFAULT 0 NOT NULL
`;
await sql`
  ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "checkout_tax_cents" integer DEFAULT 0 NOT NULL
`;
await sql`
  ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "actual_shipping_cents" integer DEFAULT 0 NOT NULL
`;
await sql`
  ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "actual_tax_cents" integer DEFAULT 0 NOT NULL
`;
await sql`
  ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "checkout_service_cents" integer DEFAULT 0 NOT NULL
`;
await sql`
  ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "actual_service_cents" integer DEFAULT 0 NOT NULL
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "order_item_merchandise_reconciliations"
      ADD CONSTRAINT "order_item_merchandise_reconciliations_order_item_id_order_items_id_fk"
      FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id")
      ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "order_item_merchandise_reconciliations"
      ADD CONSTRAINT "order_item_merchandise_reconciliations_clerk_user_id_profiles_clerk_user_id_fk"
      FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
      ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS "order_item_merchandise_reconciliations_order_item_id_unique"
  ON "order_item_merchandise_reconciliations" USING btree ("order_item_id")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "order_item_merch_recon_clerk_user_id_idx"
  ON "order_item_merchandise_reconciliations" USING btree ("clerk_user_id")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "order_item_merch_recon_status_idx"
  ON "order_item_merchandise_reconciliations" USING btree ("status")
`;

console.log("order_item_merchandise_reconciliations schema ready");
