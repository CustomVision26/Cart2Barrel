import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItems, orders, type Order } from "@/db/schema";
import {
  orderItemFulfillmentCoreSelect,
  orderItemWarehouseReceiptNulls,
} from "@/data/order-list-select";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

export type ItemRequestOrderContext = {
  order: Pick<Order, "id" | "status">;
  orderItem: OrderItemReadCore;
};

/** Latest paid (or checkout) order line per item request — canonical fulfillment source. */
export async function getOrderContextByItemRequestIds(
  itemRequestIds: string[],
): Promise<Map<string, ItemRequestOrderContext>> {
  const uniqueIds = [...new Set(itemRequestIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const db = getDb();
  try {
    const rows = await db
      .select({
        itemRequestId: orderItems.itemRequestId,
        order: {
          id: orders.id,
          status: orders.status,
        },
        orderItem: orderItemFulfillmentCoreSelect,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inArray(orderItems.itemRequestId, uniqueIds));

    const map = new Map<string, ItemRequestOrderContext>();
    for (const row of rows) {
      if (!row.itemRequestId) continue;
      map.set(row.itemRequestId, {
        order: row.order,
        orderItem: {
          ...row.orderItem,
          ...orderItemWarehouseReceiptNulls,
        },
      });
    }
    return map;
  } catch {
    const rows = await db
      .select({
        itemRequestId: orderItems.itemRequestId,
        order: {
          id: orders.id,
          status: orders.status,
        },
        orderItem: orderItemFulfillmentCoreSelect,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inArray(orderItems.itemRequestId, uniqueIds));

    const map = new Map<string, ItemRequestOrderContext>();
    for (const row of rows) {
      if (!row.itemRequestId) continue;
      map.set(row.itemRequestId, {
        order: row.order,
        orderItem: row.orderItem,
      });
    }
    return map;
  }
}
