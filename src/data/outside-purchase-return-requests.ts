import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  outsidePurchaseReturnRequests,
  type OutsidePurchaseReturnRequest,
} from "@/db/schema";
import { isMissingOutsidePurchaseReturnRequestsTableError } from "@/lib/db-column-missing";

export async function getOutsidePurchaseReturnRequestByItemRequestId(
  itemRequestId: string,
): Promise<OutsidePurchaseReturnRequest | undefined> {
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(outsidePurchaseReturnRequests)
      .where(eq(outsidePurchaseReturnRequests.itemRequestId, itemRequestId))
      .limit(1);
    return row;
  } catch (e) {
    if (isMissingOutsidePurchaseReturnRequestsTableError(e)) {
      return undefined;
    }
    throw e;
  }
}

export async function listOutsidePurchaseReturnRequestsByItemRequestIds(
  itemRequestIds: string[],
): Promise<OutsidePurchaseReturnRequest[]> {
  if (itemRequestIds.length === 0) return [];
  const db = getDb();
  try {
    return await db
      .select()
      .from(outsidePurchaseReturnRequests)
      .where(inArray(outsidePurchaseReturnRequests.itemRequestId, itemRequestIds));
  } catch (e) {
    if (isMissingOutsidePurchaseReturnRequestsTableError(e)) {
      return [];
    }
    throw e;
  }
}

export function groupReturnRequestsByItemRequestId(
  rows: OutsidePurchaseReturnRequest[],
): Record<string, OutsidePurchaseReturnRequest> {
  const map: Record<string, OutsidePurchaseReturnRequest> = {};
  for (const row of rows) {
    map[row.itemRequestId] = row;
  }
  return map;
}
