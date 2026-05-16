import { inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { orderContainerItems } from "@/db/schema";

export type OrderContainerLineAdmin = {
  id: string;
  orderId: string;
  nameSnapshot: string;
  sizeSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

/**
 * Loads checkout container lines for a set of orders (admin paid orders / history UIs).
 */
export async function listOrderContainerItemsByOrderIds(
  orderIds: string[],
): Promise<Map<string, OrderContainerLineAdmin[]>> {
  const map = new Map<string, OrderContainerLineAdmin[]>();
  if (orderIds.length === 0) return map;

  const db = getDb();
  const rows = await db
    .select({
      id: orderContainerItems.id,
      orderId: orderContainerItems.orderId,
      nameSnapshot: orderContainerItems.nameSnapshot,
      sizeSnapshot: orderContainerItems.sizeSnapshot,
      quantity: orderContainerItems.quantity,
      unitPriceCents: orderContainerItems.unitPriceCents,
      lineTotalCents: orderContainerItems.lineTotalCents,
    })
    .from(orderContainerItems)
    .where(inArray(orderContainerItems.orderId, orderIds));

  for (const r of rows) {
    const list = map.get(r.orderId) ?? [];
    list.push(r);
    map.set(r.orderId, list);
  }
  return map;
}
