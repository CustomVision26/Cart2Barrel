/**
 * Idempotent SerpApi per-user usage log table.
 * Run: npm run db:ensure-serp-api-usage
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  DO $$ BEGIN
    CREATE TYPE "public"."serp_api_search_source" AS ENUM(
      'customer_quote',
      'admin_estimate',
      'admin_spotlight',
      'retailer_check',
      'other'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE TABLE IF NOT EXISTS "serp_api_search_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "clerk_user_id" text,
    "source" "serp_api_search_source" NOT NULL,
    "engine" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS "serp_api_search_events_user_created_idx"
  ON "serp_api_search_events" USING btree ("clerk_user_id", "created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "serp_api_search_events_created_idx"
  ON "serp_api_search_events" USING btree ("created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "serp_api_search_events_source_created_idx"
  ON "serp_api_search_events" USING btree ("source", "created_at")
`;

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'serp_api_search_events'
`;
console.log(
  "serp api usage schema ready:",
  tables.map((t) => t.table_name).join(", ") || "missing",
);
