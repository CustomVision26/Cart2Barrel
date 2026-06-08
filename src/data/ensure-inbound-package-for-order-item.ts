import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { packages } from "@/db/schema";

/**
 * Ensures a single inbound `packages` row exists for an order line (used by barrel assignment).
 * Idempotent: returns existing row id when present.
 */
export async function ensureInboundPackageForOrderItem(
  orderItemId: string,
  receivedAtIso: string,
): Promise<string> {
  const db = getDb();
  const existing = await db
    .select({ id: packages.id })
    .from(packages)
    .where(eq(packages.orderItemId, orderItemId))
    .limit(1);
  if (existing[0]) {
    return existing[0].id;
  }
  const [row] = await db
    .insert(packages)
    .values({
      orderItemId,
      received: true,
      receivedAt: receivedAtIso,
    })
    .onConflictDoNothing({ target: packages.orderItemId })
    .returning({ id: packages.id });
  if (row) {
    return row.id;
  }
  const afterConflict = await db
    .select({ id: packages.id })
    .from(packages)
    .where(eq(packages.orderItemId, orderItemId))
    .limit(1);
  if (afterConflict[0]) {
    return afterConflict[0].id;
  }
  throw new Error("Could not create inbound package row.");
}
