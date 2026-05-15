import { and, count, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItemRefundRequests } from "@/db/schema";

/** Subset persisted for pending rows attached to paid-order list rows */
export type PendingRefundRequestBrief = Pick<
  (typeof orderItemRefundRequests)["$inferSelect"],
  | "id"
  | "orderItemId"
  | "reasonKind"
  | "details"
  | "requestedAmountCents"
  | "createdAt"
>;

export async function pendingRefundRequestsByOrderItemIds(
  orderItemIds: string[],
): Promise<Map<string, PendingRefundRequestBrief>> {
  if (orderItemIds.length === 0) return new Map();
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: orderItemRefundRequests.id,
        orderItemId: orderItemRefundRequests.orderItemId,
        reasonKind: orderItemRefundRequests.reasonKind,
        details: orderItemRefundRequests.details,
        requestedAmountCents: orderItemRefundRequests.requestedAmountCents,
        createdAt: orderItemRefundRequests.createdAt,
      })
      .from(orderItemRefundRequests)
      .where(
        and(
          inArray(orderItemRefundRequests.orderItemId, orderItemIds),
          eq(orderItemRefundRequests.status, "pending_approval"),
        )!,
      );
    const map = new Map<string, PendingRefundRequestBrief>();
    for (const r of rows) {
      if (!map.has(r.orderItemId)) map.set(r.orderItemId, r);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function countPendingRefundRequestsAll(): Promise<number> {
  const db = getDb();
  try {
    const [{ c }] = await db
      .select({ c: count() })
      .from(orderItemRefundRequests)
      .where(eq(orderItemRefundRequests.status, "pending_approval"));
    return Number(c ?? 0);
  } catch {
    return 0;
  }
}

export async function countPendingRefundRequestsForOwner(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  try {
    const [{ c }] = await db
      .select({ c: count() })
      .from(orderItemRefundRequests)
      .where(
        and(
          eq(orderItemRefundRequests.clerkUserId, clerkUserId),
          eq(orderItemRefundRequests.status, "pending_approval"),
        )!,
      );
    return Number(c ?? 0);
  } catch {
    return 0;
  }
}
