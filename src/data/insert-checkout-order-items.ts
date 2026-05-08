import { getDb } from "@/db";
import { orderItems } from "@/db/schema";
import type { CartLine } from "@/data/cart";
import { isUndefinedColumnError } from "@/lib/db-column-missing";
import { getNeonSql } from "@/lib/neon-sql";

/**
 * Inserts checkout order lines. Uses Drizzle first; if `fulfillment_status` is missing
 * (migration 0009 not applied), falls back to a narrow INSERT via Neon so checkout works.
 */
export async function insertCheckoutOrderItems(
  orderId: string,
  lines: CartLine[]
): Promise<{ ok: true } | { ok: false; cause: unknown }> {
  const db = getDb();
  try {
    await db.insert(orderItems).values(
      lines.map((line) => ({
        orderId,
        itemRequestId: line.request.id,
        quantity: line.request.quantity,
        price: line.quote.totalPrice,
      }))
    );
    return { ok: true };
  } catch (e) {
    if (!isUndefinedColumnError(e, "fulfillment_status")) {
      return { ok: false, cause: e };
    }
  }

  try {
    const sql = getNeonSql();
    for (const line of lines) {
      await sql`
        INSERT INTO order_items (order_id, item_request_id, quantity, price)
        VALUES (
          ${orderId}::uuid,
          ${line.request.id}::uuid,
          ${line.request.quantity},
          ${line.quote.totalPrice}
        )
      `;
    }
    return { ok: true };
  } catch (e2) {
    return { ok: false, cause: e2 };
  }
}
