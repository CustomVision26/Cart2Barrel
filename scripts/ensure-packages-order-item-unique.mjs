import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const dupOrderItems = await sql`
  SELECT order_item_id, COUNT(*)::int AS cnt
  FROM packages
  GROUP BY order_item_id
  HAVING COUNT(*) > 1
`;

for (const { order_item_id: orderItemId } of dupOrderItems) {
  const pkgs = await sql`
    SELECT p.id, p.created_at, bi.barrel_id
    FROM packages p
    LEFT JOIN barrel_items bi ON bi.package_id = p.id
    WHERE p.order_item_id = ${orderItemId}
    ORDER BY (bi.barrel_id IS NOT NULL) DESC, p.created_at ASC
  `;
  const [keep, ...remove] = pkgs;
  console.log(`order_item ${orderItemId}: keep ${keep.id}, remove ${remove.map((p) => p.id).join(", ")}`);
  for (const pkg of remove) {
    await sql`DELETE FROM barrel_package_assignment_events WHERE package_id = ${pkg.id}`;
    await sql`DELETE FROM packages WHERE id = ${pkg.id}`;
  }
}

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS packages_order_item_id_unique
  ON packages (order_item_id)
`;

const indexRows = await sql`
  SELECT indexname
  FROM pg_indexes
  WHERE tablename = 'packages'
    AND indexname = 'packages_order_item_id_unique'
`;
console.log(
  indexRows.length > 0
    ? "OK: packages.order_item_id is unique"
    : "MISSING: unique index was not created",
);
