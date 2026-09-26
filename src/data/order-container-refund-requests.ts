import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { orderContainerRefundRequests } from "@/db/schema";
import { isMissingOrderContainerRefundsTableError } from "@/lib/db-column-missing";
import type { OrderContainerRefundChargeValue } from "@/lib/validations/order-container-refund-request";
import {
  containerChargeRefundKey,
  type ContainerChargeRefundKey,
} from "@/data/order-container-refunds";

export type PendingContainerRefundRequestBrief = Pick<
  (typeof orderContainerRefundRequests)["$inferSelect"],
  | "id"
  | "orderContainerItemId"
  | "chargeTarget"
  | "reasonKind"
  | "details"
  | "requestedAmountCents"
  | "createdAt"
>;

export async function pendingContainerRefundRequestsByLineIds(
  lineIds: string[],
): Promise<Map<ContainerChargeRefundKey, PendingContainerRefundRequestBrief>> {
  const map = new Map<ContainerChargeRefundKey, PendingContainerRefundRequestBrief>();
  if (lineIds.length === 0) return map;
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: orderContainerRefundRequests.id,
        orderContainerItemId: orderContainerRefundRequests.orderContainerItemId,
        chargeTarget: orderContainerRefundRequests.chargeTarget,
        reasonKind: orderContainerRefundRequests.reasonKind,
        details: orderContainerRefundRequests.details,
        requestedAmountCents: orderContainerRefundRequests.requestedAmountCents,
        createdAt: orderContainerRefundRequests.createdAt,
      })
      .from(orderContainerRefundRequests)
      .where(
        and(
          inArray(orderContainerRefundRequests.orderContainerItemId, lineIds),
          eq(orderContainerRefundRequests.status, "pending_approval"),
        ),
      );
    for (const r of rows) {
      const key = containerChargeRefundKey(
        r.orderContainerItemId,
        r.chargeTarget as OrderContainerRefundChargeValue,
      );
      if (!map.has(key)) map.set(key, r);
    }
  } catch (e) {
    if (!isMissingOrderContainerRefundsTableError(e)) {
      console.error("[pendingContainerRefundRequestsByLineIds]", e);
    }
  }
  return map;
}
