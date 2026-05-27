/**
 * Idempotent fix for admin customer-activity notification tables.
 * Run: npm run db:ensure-admin-activity
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  DO $$ BEGIN
    CREATE TYPE "public"."admin_user_activity_event_kind" AS ENUM(
      'item_request_submitted',
      'batch_quote_submitted',
      'batch_estimate_accepted',
      'checkout_payment_succeeded',
      'refund_request_submitted',
      'product_return_requested',
      'outside_purchase_return_submitted'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'user_registered'`;
await sql`ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'user_banned'`;

await sql`
  CREATE TABLE IF NOT EXISTS "admin_user_activity_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customer_clerk_user_id" text NOT NULL,
    "kind" "admin_user_activity_event_kind" NOT NULL,
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
    ALTER TABLE "admin_user_activity_events"
    ADD CONSTRAINT "admin_user_activity_events_customer_clerk_user_id_profiles_clerk_user_id_fk"
    FOREIGN KEY ("customer_clerk_user_id")
    REFERENCES "public"."profiles"("clerk_user_id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE INDEX IF NOT EXISTS "admin_user_activity_events_customer_created_idx"
  ON "admin_user_activity_events" USING btree ("customer_clerk_user_id", "created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "admin_user_activity_events_created_idx"
  ON "admin_user_activity_events" USING btree ("created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "admin_user_activity_events_kind_created_idx"
  ON "admin_user_activity_events" USING btree ("kind", "created_at")
`;

await sql`
  CREATE TABLE IF NOT EXISTS "admin_user_activity_event_reads" (
    "event_id" uuid NOT NULL,
    "admin_clerk_user_id" text NOT NULL,
    "read_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "admin_user_activity_event_reads"
    ADD CONSTRAINT "admin_user_activity_event_reads_event_id_admin_user_activity_events_id_fk"
    FOREIGN KEY ("event_id")
    REFERENCES "public"."admin_user_activity_events"("id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_activity_event_reads_unique"
  ON "admin_user_activity_event_reads" USING btree ("event_id", "admin_clerk_user_id")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "admin_user_activity_event_reads_admin_idx"
  ON "admin_user_activity_event_reads" USING btree ("admin_clerk_user_id")
`;

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('admin_user_activity_events', 'admin_user_activity_event_reads')
  ORDER BY table_name
`;
console.log(
  "admin user activity schema ready:",
  tables.map((t) => t.table_name).join(", "),
);
