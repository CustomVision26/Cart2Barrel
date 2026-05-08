import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  itemRequests,
  orderItems,
  orders,
  type ItemRequest,
} from "@/db/schema";
import { orderListSelect, type OrderListCore } from "@/data/order-list-select";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { isUndefinedColumnError } from "@/lib/db-column-missing";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

export type DashboardPaidOrderLineRow = {
  orderItem: OrderItemReadCore;
  order: OrderListCore;
  request: ItemRequest;
  refundedCents: number;
};

const orderItemCoreSelect = {
  id: orderItems.id,
  orderId: orderItems.orderId,
  itemRequestId: orderItems.itemRequestId,
  quantity: orderItems.quantity,
  price: orderItems.price,
} as const;

const orderItemSelectWithFulfillment = {
  ...orderItemCoreSelect,
  fulfillmentStatus: orderItems.fulfillmentStatus,
} as const;

async function attachOwnerRefundedCents(
  rows: Omit<DashboardPaidOrderLineRow, "refundedCents">[]
): Promise<DashboardPaidOrderLineRow[]> {
  if (rows.length === 0) return [];
  try {
    const sums = await sumRefundedCentsByOrderItemIds(
      rows.map((r) => r.orderItem.id)
    );
    return rows.map((r) => ({
      ...r,
      refundedCents: sums.get(r.orderItem.id) ?? 0,
    }));
  } catch {
    return rows.map((r) => ({ ...r, refundedCents: 0 }));
  }
}

export async function listDashboardPaidOrderLinesForOwner(
  clerkUserId: string
): Promise<DashboardPaidOrderLineRow[]> {
  const db = getDb();

  try {
    const rows = await db
      .select({
        orderItem: orderItemSelectWithFulfillment,
        order: orderListSelect,
        request: itemRequests,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .where(and(eq(orders.clerkUserId, clerkUserId), eq(orders.status, "paid")))
      .orderBy(desc(orders.createdAt), desc(orderItems.id));
    const base = rows.map((r) => ({
      orderItem: r.orderItem,
      order: r.order,
      request: r.request,
    }));
    return attachOwnerRefundedCents(base);
  } catch (e) {
    if (!isUndefinedColumnError(e, "fulfillment_status")) {
      throw e;
    }
    const rows = await db
      .select({
        orderItem: orderItemCoreSelect,
        order: orderListSelect,
        request: itemRequests,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .where(and(eq(orders.clerkUserId, clerkUserId), eq(orders.status, "paid")))
      .orderBy(desc(orders.createdAt), desc(orderItems.id));
    const base = rows.map((r) => ({
      orderItem: r.orderItem,
      order: r.order,
      request: r.request,
    }));
    return attachOwnerRefundedCents(base);
  }
}
