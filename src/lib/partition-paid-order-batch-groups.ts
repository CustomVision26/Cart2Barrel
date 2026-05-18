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

type BatchContextLine = {
  order: { id: string };
  request: { batchQuoteSessionId: string | null };
  resolvedBatchSessionId: string | null;
  resolvedBatchNumber: string | null;
};

/**
 * Fills batch session/number on lines in the same paid order when a batch peer already resolved it
 * (e.g. sibling lines that only link via `batch_quote_session_lines`).
 */
export function propagateBatchContextWithinOrders<T extends BatchContextLine>(
  lines: T[],
): T[] {
  if (lines.length === 0) return lines;

  const byOrder = new Map<string, T[]>();
  for (const row of lines) {
    const list = byOrder.get(row.order.id) ?? [];
    list.push(row);
    byOrder.set(row.order.id, list);
  }

  return lines.map((row) => {
    const orderLines = byOrder.get(row.order.id) ?? [];
    const sessionMeta = new Map<string, string | null>();

    for (const peer of orderLines) {
      const sid =
        peer.resolvedBatchSessionId?.trim() ||
        peer.request.batchQuoteSessionId?.trim();
      if (!sid) continue;
      const bn = peer.resolvedBatchNumber?.trim() || null;
      if (!sessionMeta.has(sid) || (!sessionMeta.get(sid) && bn)) {
        sessionMeta.set(sid, bn);
      }
    }

    const requestSessionId = row.request.batchQuoteSessionId?.trim();
    const resolvedSessionId = row.resolvedBatchSessionId?.trim();

    if (resolvedSessionId) {
      return {
        ...row,
        resolvedBatchSessionId: resolvedSessionId,
        resolvedBatchNumber:
          row.resolvedBatchNumber?.trim() ||
          sessionMeta.get(resolvedSessionId) ||
          row.resolvedBatchNumber,
      };
    }

    if (requestSessionId && sessionMeta.has(requestSessionId)) {
      return {
        ...row,
        resolvedBatchSessionId: requestSessionId,
        resolvedBatchNumber:
          sessionMeta.get(requestSessionId) ?? row.resolvedBatchNumber,
      };
    }

    return row;
  });
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
