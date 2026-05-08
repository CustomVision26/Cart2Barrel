import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  itemRequests,
  orderItems,
  orders,
  profiles,
  type ItemRequest,
} from "@/db/schema";
import { orderListSelect, type OrderListCore } from "@/data/order-list-select";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { isUndefinedColumnError } from "@/lib/db-column-missing";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

import type { User } from "@clerk/nextjs/server";

export type AdminPaidOrderLineRow = {
  orderItem: OrderItemReadCore;
  order: OrderListCore;
  request: ItemRequest;
  customerEmail: string | null;
  customerFullName: string | null;
  /** Sum of Stripe refunds recorded for this line (USD cents). */
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

export async function listAdminPaidOrderLines(
  clerkUser: User | null
): Promise<AdminPaidOrderLineRow[]> {
  if (!isClerkAdmin(clerkUser)) {
    return [];
  }

  const db = getDb();

  try {
    const rows = await db
      .select({
        orderItem: orderItemSelectWithFulfillment,
        order: orderListSelect,
        request: itemRequests,
        customerEmail: profiles.email,
        customerFullName: profiles.fullName,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .innerJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
      .where(eq(orders.status, "paid"))
      .orderBy(desc(orders.createdAt), desc(orderItems.id));
    const base = rows.map((r) => ({
      orderItem: r.orderItem,
      order: r.order,
      request: r.request,
      customerEmail: r.customerEmail,
      customerFullName: r.customerFullName,
    }));
    return attachRefundedCents(base);
  } catch (e) {
    if (!isUndefinedColumnError(e, "fulfillment_status")) {
      throw e;
    }
    const rows = await db
      .select({
        orderItem: orderItemCoreSelect,
        order: orderListSelect,
        request: itemRequests,
        customerEmail: profiles.email,
        customerFullName: profiles.fullName,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .innerJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
      .where(eq(orders.status, "paid"))
      .orderBy(desc(orders.createdAt), desc(orderItems.id));
    const base = rows.map((r) => ({
      orderItem: r.orderItem,
      order: r.order,
      request: r.request,
      customerEmail: r.customerEmail,
      customerFullName: r.customerFullName,
    }));
    return attachRefundedCents(base);
  }
}

async function attachRefundedCents(
  rows: Omit<AdminPaidOrderLineRow, "refundedCents">[]
): Promise<AdminPaidOrderLineRow[]> {
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
