import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TYPE "item_request_status" ADD VALUE IF NOT EXISTS 'out_of_stock'`;

const rows = await sql`
  SELECT unnest(enum_range(NULL::item_request_status))::text AS v
`;
console.log(
  "item_request_status values:",
  rows.map((r) => r.v).join(", ")
);
