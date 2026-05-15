import type { ItemRequest } from "@/db/schema";

type LineSortable<TOrderItem extends { id: string }> = {
  order: { id: string };
  orderItem: TOrderItem;
  request: ItemRequest;
  resolvedBatchSessionId: string | null;
  resolvedBatchNumber: string | null;
};

/**
 * Matches page order IDs, batches first (by batch label), singles last, then product name / line id.
 */
export function sortPaidOrderLinesWithinPage<
  T extends LineSortable<{ id: string }>,
>(lines: T[], orderedOrderIds: string[]): T[] {
  const idx = new Map(orderedOrderIds.map((id, i) => [id, i]));
  return [...lines].sort((a, b) => {
    const oa = idx.get(a.order.id) ?? 0;
    const ob = idx.get(b.order.id) ?? 0;
    if (oa !== ob) return oa - ob;
    const aBatch = !!(a.resolvedBatchSessionId && a.resolvedBatchSessionId.trim());
    const bBatch = !!(b.resolvedBatchSessionId && b.resolvedBatchSessionId.trim());
    if (aBatch !== bBatch) return aBatch ? -1 : 1;
    if (aBatch) {
      const bn = (a.resolvedBatchNumber ?? "").localeCompare(
        b.resolvedBatchNumber ?? "",
      );
      if (bn !== 0) return bn;
    }
    const pa = (a.request.productName ?? "").toLowerCase();
    const pb = (b.request.productName ?? "").toLowerCase();
    const pn = pa.localeCompare(pb);
    if (pn !== 0) return pn;
    return a.orderItem.id.localeCompare(b.orderItem.id);
  });
}
