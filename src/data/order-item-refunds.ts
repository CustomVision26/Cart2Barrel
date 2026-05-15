import { asc, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItemRefunds } from "@/db/schema";

export type OrderItemRefundDetail = Pick<
  typeof orderItemRefunds.$inferSelect,
  "id" | "orderItemId" | "amountCents" | "stripeRefundId" | "reason" | "createdAt"
>;

export async function sumRefundedCentsByOrderItemIds(
  orderItemIds: string[]
): Promise<Map<string, number>> {
  if (orderItemIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      orderItemId: orderItemRefunds.orderItemId,
      total: sql<number>`coalesce(sum(${orderItemRefunds.amountCents}), 0)::int`,
    })
    .from(orderItemRefunds)
    .where(inArray(orderItemRefunds.orderItemId, orderItemIds))
    .groupBy(orderItemRefunds.orderItemId);
  return new Map(rows.map((r) => [r.orderItemId, r.total]));
}

export async function insertOrderItemRefundRow(params: {
  orderItemId: string;
  amountCents: number;
  stripeRefundId: string;
  reason: string | null;
  createdByClerkUserId: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(orderItemRefunds).values({
    orderItemId: params.orderItemId,
    amountCents: params.amountCents,
    stripeRefundId: params.stripeRefundId,
    reason: params.reason,
    createdByClerkUserId: params.createdByClerkUserId,
  });
}

export async function listOrderItemRefundDetailsByOrderItemIds(
  orderItemIds: string[],
): Promise<Map<string, OrderItemRefundDetail[]>> {
  if (orderItemIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      id: orderItemRefunds.id,
      orderItemId: orderItemRefunds.orderItemId,
      amountCents: orderItemRefunds.amountCents,
      stripeRefundId: orderItemRefunds.stripeRefundId,
      reason: orderItemRefunds.reason,
      createdAt: orderItemRefunds.createdAt,
    })
    .from(orderItemRefunds)
    .where(inArray(orderItemRefunds.orderItemId, orderItemIds))
    .orderBy(asc(orderItemRefunds.createdAt));

  const byOrderItemId = new Map<string, OrderItemRefundDetail[]>();
  for (const row of rows) {
    const list = byOrderItemId.get(row.orderItemId);
    if (list) list.push(row);
    else byOrderItemId.set(row.orderItemId, [row]);
  }
  return byOrderItemId;
}
