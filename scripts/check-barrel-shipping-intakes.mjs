import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

try {
  const cols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'barrel_shipping_intakes'
    ORDER BY ordinal_position
  `;
  console.log("columns:", cols);

  const clerkUserId = "user_3DDclrRY5GUxCBOXaRFBQIfov6Q";
  const rows = await sql`
    SELECT b.id, i.id as intake_id
    FROM barrels b
    LEFT JOIN order_container_items oci ON b.order_container_item_id = oci.id
    LEFT JOIN barrel_shipping_intakes i ON i.barrel_id = b.id
    WHERE b.clerk_user_id = ${clerkUserId}
    LIMIT 3
  `;
  console.log("query ok, rows:", rows.length, rows);
} catch (e) {
  console.error("ERR:", e.message);
  console.error(e);
  process.exit(1);
}
