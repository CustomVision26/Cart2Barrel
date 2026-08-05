/**
 * Idempotent quote expiry settings table (minutes-based window).
 * Run: npm run db:ensure-quote-expiry
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS "quote_expiry_settings" (
    "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
    "expiry_minutes" integer DEFAULT 10080 NOT NULL,
    "updated_by_clerk_user_id" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

// Legacy installs that still have expiry_days: add minutes, backfill, drop days.
await sql`
  ALTER TABLE "quote_expiry_settings"
  ADD COLUMN IF NOT EXISTS "expiry_minutes" integer
`;

const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'quote_expiry_settings'
    AND column_name IN ('expiry_days', 'expiry_minutes')
`;
const names = new Set(cols.map((r) => r.column_name));

if (names.has("expiry_days")) {
  await sql`
    UPDATE "quote_expiry_settings"
    SET "expiry_minutes" = GREATEST(1, COALESCE("expiry_days", 7) * 24 * 60)
    WHERE "expiry_minutes" IS NULL
  `;
  await sql`
    ALTER TABLE "quote_expiry_settings"
    DROP COLUMN IF EXISTS "expiry_days"
  `;
}

await sql`
  UPDATE "quote_expiry_settings"
  SET "expiry_minutes" = 10080
  WHERE "expiry_minutes" IS NULL
`;

await sql`
  ALTER TABLE "quote_expiry_settings"
  ALTER COLUMN "expiry_minutes" SET DEFAULT 10080
`;

await sql`
  ALTER TABLE "quote_expiry_settings"
  ALTER COLUMN "expiry_minutes" SET NOT NULL
`;

await sql`
  INSERT INTO "quote_expiry_settings" ("singleton_key", "expiry_minutes")
  VALUES ('default', 10080)
  ON CONFLICT ("singleton_key") DO NOTHING
`;

await sql`
  CREATE TABLE IF NOT EXISTS "customer_quote_expiry_settings" (
    "clerk_user_id" text PRIMARY KEY NOT NULL
      REFERENCES "profiles"("clerk_user_id") ON DELETE CASCADE,
    "expiry_minutes" integer NOT NULL,
    "updated_by_clerk_user_id" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  ALTER TABLE "item_requests"
  ADD COLUMN IF NOT EXISTS "quote_expiry_minutes_override" integer
`;

await sql`
  ALTER TABLE "item_requests"
  ADD COLUMN IF NOT EXISTS "quote_expiry_override_anchored_at" timestamp with time zone
`;

await sql`
  UPDATE "item_requests"
  SET "quote_expiry_override_anchored_at" = now()
  WHERE "quote_expiry_minutes_override" IS NOT NULL
    AND "quote_expiry_override_anchored_at" IS NULL
`;

console.log(
  "quote_expiry_settings ready (expiry_minutes + customer + product overrides + publish anchor)",
);
