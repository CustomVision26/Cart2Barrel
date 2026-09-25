/**
 * Idempotent first-party page-visit log table.
 * Run: npm run db:ensure-page-visits
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS "page_visits" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "visitor_id" uuid NOT NULL,
    "clerk_user_id" text,
    "path" text NOT NULL,
    "referrer" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS "page_visits_visitor_created_idx"
  ON "page_visits" USING btree ("visitor_id", "created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "page_visits_user_created_idx"
  ON "page_visits" USING btree ("clerk_user_id", "created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "page_visits_path_created_idx"
  ON "page_visits" USING btree ("path", "created_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "page_visits_created_idx"
  ON "page_visits" USING btree ("created_at")
`;

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'page_visits'
`;
console.log(
  "page visits schema ready:",
  tables.map((t) => t.table_name).join(", ") || "missing",
);
