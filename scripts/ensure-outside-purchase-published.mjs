import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "outside_purchase_published_at" timestamp with time zone`;

await sql`ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_published'`;
await sql`ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_unpublished'`;

const backfill = await sql`
  UPDATE "item_requests"
  SET "outside_purchase_published_at" = "created_at"
  WHERE "source" = 'outside_purchase'
    AND "outside_purchase_published_at" IS NULL
  RETURNING id
`;

console.log(
  `OK: outside_purchase_published_at ready; backfilled ${backfill.length} existing outside-purchase row(s).`,
);
