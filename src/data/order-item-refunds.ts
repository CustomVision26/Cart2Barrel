import { inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItemRefunds } from "@/db/schema";

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
