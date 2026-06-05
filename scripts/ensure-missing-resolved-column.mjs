import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "outside_purchase_missing_resolved_at" timestamp with time zone`;

const rows = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'item_requests'
    AND column_name = 'outside_purchase_missing_resolved_at'
`;
console.log(
  rows.length > 0
    ? "OK: item_requests.outside_purchase_missing_resolved_at exists"
    : "MISSING: column was not created",
);
