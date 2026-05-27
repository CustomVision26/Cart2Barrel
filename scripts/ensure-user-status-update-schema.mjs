/**
 * Idempotent fix for shopper status-update notification tables.
 * Run: npm run db:ensure-user-status-updates
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  DO $$ BEGIN
    CREATE TYPE "public"."user_status_update_kind" AS ENUM(
      'estimate_ready',
      'batch_estimate_ready',
      'item_out_of_stock',
      'company_purchase_confirmed',
      'purchase_tracking_updated',
      'refund_approved',
      'refund_rejected',
      'product_return_fulfilled',
      'outside_purchase_return_estimate_ready'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'account_welcome'`;
await sql`ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'account_suspended'`;
await sql`ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'account_reinstated'`;

await sql`
  CREATE TABLE IF NOT EXISTS "user_status_update_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "clerk_user_id" text NOT NULL,
    "kind" "user_status_update_kind" NOT NULL,
    "title" text NOT NULL,
    "body" text,
    "href" text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "user_status_update_events"
    ADD CONSTRAINT "user_status_update_events_clerk_user_id_profiles_clerk_user_id_fk"
    FOREIGN KEY ("clerk_user_id")
    REFERENCES "public"."profiles"("clerk_user_id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE INDEX IF NOT EXISTS "user_status_update_events_user_created_idx"
  ON "user_status_update_events" USING btree ("clerk_user_id", "created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "user_status_update_events_created_idx"
  ON "user_status_update_events" USING btree ("created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "user_status_update_events_kind_created_idx"
  ON "user_status_update_events" USING btree ("kind", "created_at")
`;

await sql`
  CREATE TABLE IF NOT EXISTS "user_status_update_event_reads" (
    "event_id" uuid NOT NULL,
    "read_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "user_status_update_event_reads"
    ADD CONSTRAINT "user_status_update_event_reads_event_id_user_status_update_events_id_fk"
    FOREIGN KEY ("event_id")
    REFERENCES "public"."user_status_update_events"("id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS "user_status_update_event_reads_unique"
  ON "user_status_update_event_reads" USING btree ("event_id")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "user_status_update_event_reads_event_idx"
  ON "user_status_update_event_reads" USING btree ("event_id")
`;

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('user_status_update_events', 'user_status_update_event_reads')
  ORDER BY table_name
`;
console.log(
  "user status update schema ready:",
  tables.map((t) => t.table_name).join(", "),
);
