/** Batch subtree per order slice (lines must already be order-scoped, batch-first ordering). */

export type BatchGroupPartition<T extends { resolvedBatchSessionId: string | null }> =
  | {
      kind: "batch";
      batchSessionId: string;
      batchNumber: string | null;
      lines: T[];
    }
  | { kind: "single"; lines: T[] };

/** Preserves line order within each batch / singles bucket. */
export function partitionPaidLinesIntoBatchBuckets<
  T extends {
    resolvedBatchSessionId: string | null;
    resolvedBatchNumber: string | null;
  },
>(linesInSingleOrder: T[]): BatchGroupPartition<T>[] {
  const batchInsertionOrder: string[] = [];
  const batchLines = new Map<string, { lines: T[]; batchNumber: string | null }>();
  const singles: T[] = [];

  for (const row of linesInSingleOrder) {
    const sid = row.resolvedBatchSessionId?.trim();
    if (sid) {
      if (!batchLines.has(sid)) {
        batchInsertionOrder.push(sid);
        batchLines.set(sid, { lines: [], batchNumber: row.resolvedBatchNumber });
      }
      const g = batchLines.get(sid)!;
      if (!g.batchNumber && row.resolvedBatchNumber?.trim()) {
        g.batchNumber = row.resolvedBatchNumber.trim();
      }
      g.lines.push(row);
    } else singles.push(row);
  }

  const out: BatchGroupPartition<T>[] = batchInsertionOrder.map((sid) => {
    const g = batchLines.get(sid)!;
    return {
      kind: "batch",
      batchSessionId: sid,
      batchNumber: g.batchNumber,
      lines: g.lines,
    };
  });
  if (singles.length > 0) out.push({ kind: "single", lines: singles });
  return out;
}

/** Groups flat line rows under their order (`rows` server order yields stable order grouping). */
export function groupPaidRowsStableByOrder<
  T extends { order: { id: string } },
>(rows: T[]): { order: T["order"]; lines: T[] }[] {
  const ids: string[] = [];
  const map = new Map<string, { order: T["order"]; lines: T[] }>();

  for (const row of rows) {
    const oid = row.order.id;
    if (!map.has(oid)) {
      ids.push(oid);
      map.set(oid, { order: row.order, lines: [] });
    }
    map.get(oid)!.lines.push(row);
  }

  return ids.map((id) => map.get(id)!);
}
