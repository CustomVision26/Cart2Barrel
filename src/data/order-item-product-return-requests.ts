import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  orderItemProductReturnRequests,
  type OrderItemProductReturnRequest,
} from "@/db/schema";
import {
  isMissingOrderItemProductReturnRequestsTableError,
  isMissingProductReturnDesiredOutcomeColumnError,
} from "@/lib/db-column-missing";

export type PendingProductReturnRequestBrief = Pick<
  OrderItemProductReturnRequest,
  | "id"
  | "orderItemId"
  | "desiredOutcome"
  | "reasonKind"
  | "details"
  | "returnWindowStart"
  | "returnWindowEnd"
  | "customerNotes"
  | "createdAt"
>;

export type FulfilledProductReturnRequestBrief = Pick<
  OrderItemProductReturnRequest,
  | "id"
  | "orderItemId"
  | "desiredOutcome"
  | "reasonKind"
  | "details"
  | "returnWindowStart"
  | "returnWindowEnd"
  | "customerNotes"
  | "createdAt"
  | "fulfilledAt"
>;

export type ProductReturnRequestRecordBrief = PendingProductReturnRequestBrief & {
  status: OrderItemProductReturnRequest["status"];
  fulfilledAt: OrderItemProductReturnRequest["fulfilledAt"];
};

export async function pendingProductReturnRequestsByOrderItemIds(
  orderItemIds: string[],
): Promise<Map<string, PendingProductReturnRequestBrief>> {
  if (orderItemIds.length === 0) return new Map();
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: orderItemProductReturnRequests.id,
        orderItemId: orderItemProductReturnRequests.orderItemId,
        desiredOutcome: orderItemProductReturnRequests.desiredOutcome,
        reasonKind: orderItemProductReturnRequests.reasonKind,
        details: orderItemProductReturnRequests.details,
        returnWindowStart: orderItemProductReturnRequests.returnWindowStart,
        returnWindowEnd: orderItemProductReturnRequests.returnWindowEnd,
        customerNotes: orderItemProductReturnRequests.customerNotes,
        createdAt: orderItemProductReturnRequests.createdAt,
      })
      .from(orderItemProductReturnRequests)
      .where(
        and(
          inArray(orderItemProductReturnRequests.orderItemId, orderItemIds),
          eq(orderItemProductReturnRequests.status, "submitted"),
        )!,
      );
    const map = new Map<string, PendingProductReturnRequestBrief>();
    for (const r of rows) {
      if (!map.has(r.orderItemId)) map.set(r.orderItemId, r);
    }
    return map;
  } catch (e) {
    if (
      isMissingOrderItemProductReturnRequestsTableError(e) ||
      isMissingProductReturnDesiredOutcomeColumnError(e)
    ) {
      if (isMissingProductReturnDesiredOutcomeColumnError(e)) {
        try {
          const rows = await db
            .select({
              id: orderItemProductReturnRequests.id,
              orderItemId: orderItemProductReturnRequests.orderItemId,
              reasonKind: orderItemProductReturnRequests.reasonKind,
              details: orderItemProductReturnRequests.details,
              returnWindowStart: orderItemProductReturnRequests.returnWindowStart,
              returnWindowEnd: orderItemProductReturnRequests.returnWindowEnd,
              customerNotes: orderItemProductReturnRequests.customerNotes,
              createdAt: orderItemProductReturnRequests.createdAt,
            })
            .from(orderItemProductReturnRequests)
            .where(
              and(
                inArray(orderItemProductReturnRequests.orderItemId, orderItemIds),
                eq(orderItemProductReturnRequests.status, "submitted"),
              )!,
            );
          const map = new Map<string, PendingProductReturnRequestBrief>();
          for (const r of rows) {
            if (!map.has(r.orderItemId)) {
              map.set(r.orderItemId, { ...r, desiredOutcome: null });
            }
          }
          return map;
        } catch {
          return new Map();
        }
      }
      return new Map();
    }
    throw e;
  }
}

export async function productReturnRequestsByOrderItemIds(
  orderItemIds: string[],
): Promise<Map<string, ProductReturnRequestRecordBrief>> {
  if (orderItemIds.length === 0) return new Map();
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: orderItemProductReturnRequests.id,
        orderItemId: orderItemProductReturnRequests.orderItemId,
        status: orderItemProductReturnRequests.status,
        desiredOutcome: orderItemProductReturnRequests.desiredOutcome,
        reasonKind: orderItemProductReturnRequests.reasonKind,
        details: orderItemProductReturnRequests.details,
        returnWindowStart: orderItemProductReturnRequests.returnWindowStart,
        returnWindowEnd: orderItemProductReturnRequests.returnWindowEnd,
        customerNotes: orderItemProductReturnRequests.customerNotes,
        createdAt: orderItemProductReturnRequests.createdAt,
        fulfilledAt: orderItemProductReturnRequests.fulfilledAt,
      })
      .from(orderItemProductReturnRequests)
      .where(inArray(orderItemProductReturnRequests.orderItemId, orderItemIds));
    const map = new Map<string, ProductReturnRequestRecordBrief>();
    for (const r of rows) {
      if (!map.has(r.orderItemId)) map.set(r.orderItemId, r);
    }
    return map;
  } catch (e) {
    if (
      isMissingOrderItemProductReturnRequestsTableError(e) ||
      isMissingProductReturnDesiredOutcomeColumnError(e)
    ) {
      return new Map();
    }
    throw e;
  }
}

export async function fulfilledProductReturnRequestsByOrderItemIds(
  orderItemIds: string[],
): Promise<Map<string, FulfilledProductReturnRequestBrief>> {
  const all = await productReturnRequestsByOrderItemIds(orderItemIds);
  const map = new Map<string, FulfilledProductReturnRequestBrief>();
  for (const [orderItemId, record] of all) {
    if (record.status === "fulfilled") {
      map.set(orderItemId, record);
    }
  }
  return map;
}

export async function getProductReturnRequestByOrderItemId(
  orderItemId: string,
): Promise<OrderItemProductReturnRequest | undefined> {
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(orderItemProductReturnRequests)
      .where(eq(orderItemProductReturnRequests.orderItemId, orderItemId))
      .limit(1);
    return row;
  } catch (e) {
    if (isMissingOrderItemProductReturnRequestsTableError(e)) {
      return undefined;
    }
    throw e;
  }
}
