import type { OrderSlideGroup } from "@/lib/admin-orders-slide-filters";
import { partitionPaidLinesIntoBatchBuckets } from "@/lib/partition-paid-order-batch-groups";

export const ORDER_SLIDE_PREVIEW_SLOT_COUNT = 4;

export type OrderSlidePreviewTile = {
  imageUrl: string | null;
  label: string;
};

export function orderSlidePreviewTiles(group: OrderSlideGroup): OrderSlidePreviewTile[] {
  const buckets = partitionPaidLinesIntoBatchBuckets(group.lines);
  const tiles: OrderSlidePreviewTile[] = [];

  for (const bucket of buckets) {
    if (bucket.kind === "batch") {
      const first = bucket.lines[0];
      if (first) {
        tiles.push({
          imageUrl: first.request.productImageUrl,
          label: bucket.batchNumber?.trim() || `Batch · ${bucket.lines.length}`,
        });
      }
    } else {
      for (const row of bucket.lines) {
        tiles.push({
          imageUrl: row.request.productImageUrl,
          label: row.request.productName?.trim() || "Single",
        });
      }
    }
  }

  return tiles.slice(0, ORDER_SLIDE_PREVIEW_SLOT_COUNT);
}

export function orderSlideCountSummary(
  group: OrderSlideGroup,
  containerCount: number,
): string {
  const buckets = partitionPaidLinesIntoBatchBuckets(group.lines);
  let batchProducts = 0;
  let singles = 0;
  for (const b of buckets) {
    if (b.kind === "batch") batchProducts += b.lines.length;
    else singles += b.lines.length;
  }
  const parts: string[] = [];
  if (batchProducts > 0) {
    parts.push(
      `${batchProducts} batch ${batchProducts === 1 ? "item" : "items"}`,
    );
  }
  if (singles > 0) {
    parts.push(`${singles} single ${singles === 1 ? "item" : "items"}`);
  }
  if (containerCount > 0) {
    parts.push(
      `${containerCount} ${containerCount === 1 ? "container" : "containers"}`,
    );
  }
  return parts.join(" · ") || `${group.lines.length} items`;
}

export function orderSlidePreviewExtraCount(group: OrderSlideGroup): number {
  const tiles = orderSlidePreviewTiles(group);
  return Math.max(
    0,
    partitionPaidLinesIntoBatchBuckets(group.lines).reduce(
      (n, b) => n + (b.kind === "batch" ? 1 : b.lines.length),
      0,
    ) - tiles.length,
  );
}
