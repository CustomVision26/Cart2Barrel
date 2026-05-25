import type {
  BatchQuoteEstimate,
  ItemQuote,
  ItemRequestLineSnapshot,
  OrderItem,
} from "@/db/schema";

/** Client-safe staff/admin identity slice for Updated-by columns. */
export type AdminStaffProfileSlice = {
  fullName: string | null;
  email: string | null;
};

export type AdminStaffProfilesByClerkUserId = Record<
  string,
  AdminStaffProfileSlice
>;

export function resolveOrderLineUpdatedByClerkUserId(
  orderItem: Pick<
    OrderItem,
    | "warehouseReceivedByClerkUserId"
    | "companyPurchaseUpdatedByClerkUserId"
  > | {
    warehouseReceivedByClerkUserId?: string | null;
    companyPurchaseUpdatedByClerkUserId?: string | null;
  },
): string | null {
  return (
    orderItem.warehouseReceivedByClerkUserId?.trim() ||
    orderItem.companyPurchaseUpdatedByClerkUserId?.trim() ||
    null
  );
}

export function quoteRecordedByClerkUserId(
  quote: Pick<ItemQuote, "recordedByClerkUserId"> | null | undefined,
): string | null {
  return quote?.recordedByClerkUserId?.trim() || null;
}

export function batchEstimateRecordedByClerkUserId(
  estimate: Pick<BatchQuoteEstimate, "recordedByClerkUserId"> | null | undefined,
): string | null {
  return estimate?.recordedByClerkUserId?.trim() || null;
}

export function snapshotRecordedByClerkUserId(
  snapshot: Pick<ItemRequestLineSnapshot, "recordedByClerkUserId"> | null | undefined,
): string | null {
  return snapshot?.recordedByClerkUserId?.trim() || null;
}

export function latestSnapshotRecordedByClerkUserId(
  snapshots: ItemRequestLineSnapshot[],
): string | null {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const snap of sorted) {
    const id = snapshotRecordedByClerkUserId(snap);
    if (id) return id;
  }
  return null;
}
