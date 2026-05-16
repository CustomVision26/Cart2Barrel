import { getDb } from "@/db";
import { orderItems } from "@/db/schema";
import type { CheckoutOrderLineInput } from "@/data/cart";
import { isUndefinedColumnError } from "@/lib/db-column-missing";
import { getNeonSql } from "@/lib/neon-sql";

/**
 * Inserts checkout order lines. Uses Drizzle first; if `fulfillment_status` is missing
 * (migration 0009 not applied), falls back to a narrow INSERT via Neon so checkout works.
 */
export async function insertCheckoutOrderItems(
  orderId: string,
  lines: CheckoutOrderLineInput[]
): Promise<{ ok: true } | { ok: false; cause: unknown }> {
  if (lines.length === 0) return { ok: true };
  const db = getDb();
  try {
    await db.insert(orderItems).values(
      lines.map((line) => ({
        orderId,
        itemRequestId: line.itemRequestId,
        quantity: line.quantity,
        price: line.priceCents,
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
          ${line.itemRequestId}::uuid,
          ${line.quantity},
          ${line.priceCents}
        )
      `;
    }
    return { ok: true };
  } catch (e2) {
    return { ok: false, cause: e2 };
  }
}
