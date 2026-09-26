import { inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { orderContainerRefunds } from "@/db/schema";
import { isMissingOrderContainerRefundsTableError } from "@/lib/db-column-missing";
import type { OrderContainerRefundChargeValue } from "@/lib/validations/order-container-refund-request";

export type ContainerChargeRefundKey = `${string}:${OrderContainerRefundChargeValue}`;

export function containerChargeRefundKey(
  orderContainerItemId: string,
  chargeTarget: OrderContainerRefundChargeValue,
): ContainerChargeRefundKey {
  return `${orderContainerItemId}:${chargeTarget}`;
}

export async function sumContainerChargeRefundedCents(
  lineIds: string[],
): Promise<Map<ContainerChargeRefundKey, number>> {
  const map = new Map<ContainerChargeRefundKey, number>();
  if (lineIds.length === 0) return map;
  const db = getDb();
  try {
    const rows = await db
      .select({
        orderContainerItemId: orderContainerRefunds.orderContainerItemId,
        chargeTarget: orderContainerRefunds.chargeTarget,
        total: sql<number>`coalesce(sum(${orderContainerRefunds.amountCents}), 0)::int`,
      })
      .from(orderContainerRefunds)
      .where(inArray(orderContainerRefunds.orderContainerItemId, lineIds))
      .groupBy(
        orderContainerRefunds.orderContainerItemId,
        orderContainerRefunds.chargeTarget,
      );
    for (const row of rows) {
      map.set(
        containerChargeRefundKey(
          row.orderContainerItemId,
          row.chargeTarget as OrderContainerRefundChargeValue,
        ),
        Number(row.total ?? 0),
      );
    }
  } catch (e) {
    if (!isMissingOrderContainerRefundsTableError(e)) {
      console.error("[sumContainerChargeRefundedCents]", e);
    }
  }
  return map;
}

export async function insertOrderContainerRefundRow(input: {
  orderContainerItemId: string;
  chargeTarget: OrderContainerRefundChargeValue;
  amountCents: number;
  stripeRefundId: string;
  reason: string | null;
  createdByClerkUserId: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(orderContainerRefunds).values({
    orderContainerItemId: input.orderContainerItemId,
    chargeTarget: input.chargeTarget,
    amountCents: input.amountCents,
    stripeRefundId: input.stripeRefundId,
    reason: input.reason,
    createdByClerkUserId: input.createdByClerkUserId,
  });
}

export async function listOrderContainerRefundsByLineIds(lineIds: string[]) {
  if (lineIds.length === 0) return [];
  const db = getDb();
  try {
    return await db
      .select()
      .from(orderContainerRefunds)
      .where(inArray(orderContainerRefunds.orderContainerItemId, lineIds));
  } catch (e) {
    if (!isMissingOrderContainerRefundsTableError(e)) throw e;
    return [];
  }
}
