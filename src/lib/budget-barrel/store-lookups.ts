export type StoreLookupCandidate = {
  queryId: string;
  retailerKey: string;
};

/**
 * Gives every search that still needs a retailer page a lookup before any
 * search gets a second one. Pending tokens arrive query-by-query, and taking
 * the first N would spend the whole budget on the first item.
 */
export function pickStoreLookups<T extends StoreLookupCandidate>(
  pending: T[],
  coveredQueryIds: ReadonlySet<string>,
  limit: number,
): T[] {
  if (limit <= 0 || pending.length === 0) return [];
  const needy = new Map<string, T[]>();
  const covered = new Map<string, T[]>();
  for (const row of pending) {
    const groups = coveredQueryIds.has(row.queryId) ? covered : needy;
    const list = groups.get(row.queryId) ?? [];
    list.push(row);
    groups.set(row.queryId, list);
  }

  const picked: T[] = [];
  drain(needy, picked, limit, true);
  drain(needy, picked, limit, false);
  drain(covered, picked, limit, true);
  return picked;
}

function drain<T extends StoreLookupCandidate>(
  groups: Map<string, T[]>,
  picked: T[],
  limit: number,
  onePerRetailer: boolean,
) {
  const ids = [...groups.keys()].sort();
  const cursors = new Map<string, number>(ids.map((id) => [id, 0]));
  const seenRetailer = new Set<string>();
  let progressed = true;
  while (picked.length < limit && progressed) {
    progressed = false;
    for (const id of ids) {
      if (picked.length >= limit) return;
      const list = groups.get(id) ?? [];
      let cursor = cursors.get(id) ?? 0;
      while (cursor < list.length) {
        const row = list[cursor];
        cursor += 1;
        if (picked.includes(row)) continue;
        const retailerKey = `${id}:${row.retailerKey}`;
        if (onePerRetailer && seenRetailer.has(retailerKey)) continue;
        seenRetailer.add(retailerKey);
        picked.push(row);
        progressed = true;
        break;
      }
      cursors.set(id, cursor);
    }
  }
}
