/** Shared tier band editor helpers for admin service & handling fee tables. */

export type FeeTierServerPayload = {
  maxUnitPriceInclusiveCents: number;
  feePerUnitCents: number;
};

export type FeeTierFormRow = {
  minUnitPriceInclusiveCents: number;
  maxUnitPriceInclusiveCents: number;
  feePerUnitCents: number;
};

export const OPEN_ENDED_MAX_THRESHOLD_CENTS = 1_000_000_000;

export function centsToUsdInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, cents) / 100);
}

export function isOpenEndedMax(maxCents: number): boolean {
  return maxCents >= OPEN_ENDED_MAX_THRESHOLD_CENTS;
}

export function sortTierRows(rows: FeeTierFormRow[]): FeeTierFormRow[] {
  return [...rows].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
}

export function serverTiersToFormRows(db: FeeTierServerPayload[]): FeeTierFormRow[] {
  const sorted = [...db].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
  return sorted.map((t, i) => ({
    minUnitPriceInclusiveCents:
      i === 0 ? 1 : sorted[i - 1]!.maxUnitPriceInclusiveCents + 1,
    maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
    feePerUnitCents: t.feePerUnitCents,
  }));
}

export function parseUsdToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "" || t === ".") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Keep partial dollar amounts editable while typing (e.g. "20." or "1.5"). */
export function sanitizeUsdInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const head = cleaned.slice(0, dot + 1);
  const tail = cleaned.slice(dot + 1).replace(/\./g, "");
  return head + tail;
}

export function normalizeUsdInputOnBlur(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === ".") return "0.00";
  return centsToUsdInput(parseUsdToCents(trimmed));
}

export type FeeTierEditableRow = {
  id: string;
  minUsd: string;
  maxUsd: string;
  feeUsd: string;
  openEndedMax: boolean;
};

function newTierRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function serverTiersToEditableRows(
  db: FeeTierServerPayload[],
): FeeTierEditableRow[] {
  return serverTiersToFormRows(db).map((row) => ({
    id: newTierRowId(),
    minUsd: centsToUsdInput(row.minUnitPriceInclusiveCents),
    maxUsd: isOpenEndedMax(row.maxUnitPriceInclusiveCents)
      ? "0.00"
      : centsToUsdInput(row.maxUnitPriceInclusiveCents),
    feeUsd: centsToUsdInput(row.feePerUnitCents),
    openEndedMax: isOpenEndedMax(row.maxUnitPriceInclusiveCents),
  }));
}

export function editableRowsToCentsRows(
  rows: FeeTierEditableRow[],
): FeeTierFormRow[] {
  return rows.map((row) => ({
    minUnitPriceInclusiveCents: parseUsdToCents(row.minUsd),
    maxUnitPriceInclusiveCents: row.openEndedMax
      ? OPEN_ENDED_MAX_THRESHOLD_CENTS
      : parseUsdToCents(row.maxUsd),
    feePerUnitCents: parseUsdToCents(row.feeUsd),
  }));
}

export function sortEditableRowsForDisplay(
  rows: FeeTierEditableRow[],
): FeeTierEditableRow[] {
  return [...rows].sort((a, b) => {
    const maxA = a.openEndedMax ? Number.POSITIVE_INFINITY : parseUsdToCents(a.maxUsd);
    const maxB = b.openEndedMax ? Number.POSITIVE_INFINITY : parseUsdToCents(b.maxUsd);
    return maxA - maxB;
  });
}

export function addEditableTierRow(
  rows: FeeTierEditableRow[],
): FeeTierEditableRow[] {
  const sorted = sortEditableRowsForDisplay(rows);
  const openEndedIndex = sorted.findIndex((r) => r.openEndedMax);
  const insertBefore =
    openEndedIndex >= 0 ? sorted[openEndedIndex] : sorted[sorted.length - 1];
  const penult =
    openEndedIndex >= 1 ? sorted[openEndedIndex - 1]
    : openEndedIndex === 0 ? null
    : sorted.length >= 2 ? sorted[sorted.length - 2]
    : null;
  const baseCents =
    penult ? parseUsdToCents(penult.maxUsd)
    : insertBefore && !insertBefore.openEndedMax ?
      parseUsdToCents(insertBefore.maxUsd)
    : 0;
  const newMaxCents = baseCents + 10_000;
  const newRow: FeeTierEditableRow = {
    id: newTierRowId(),
    minUsd: centsToUsdInput(baseCents + 1),
    maxUsd: centsToUsdInput(newMaxCents),
    feeUsd: "0.00",
    openEndedMax: false,
  };

  if (openEndedIndex >= 0 && insertBefore) {
    return rows.flatMap((row) => {
      if (row.id === insertBefore.id) {
        return [
          newRow,
          {
            ...row,
            minUsd: centsToUsdInput(newMaxCents + 1),
          },
        ];
      }
      return [row];
    });
  }

  return [...rows, newRow];
}

export function removeEditableTierRow(
  rows: FeeTierEditableRow[],
  rowId: string,
): FeeTierEditableRow[] {
  return rows.filter((row) => row.id !== rowId);
}

export function syncNextMinAfterMaxBlur(
  rows: FeeTierEditableRow[],
  rowId: string,
): FeeTierEditableRow[] {
  const sorted = sortEditableRowsForDisplay(rows);
  const index = sorted.findIndex((row) => row.id === rowId);
  if (index < 0) return rows;
  const current = sorted[index]!;
  const next = sorted[index + 1];
  if (!next || current.openEndedMax) return rows;

  const nextMinUsd = centsToUsdInput(parseUsdToCents(current.maxUsd) + 1);
  return rows.map((row) =>
    row.id === next.id ? { ...row, minUsd: nextMinUsd } : row,
  );
}

export function prepareEditableRowsForSave(
  rows: FeeTierEditableRow[],
): FeeTierFormRow[] {
  return sortTierRows(editableRowsToCentsRows(rows));
}

export function validateTiers(sorted: FeeTierFormRow[]): string | null {
  let openEndedCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (isOpenEndedMax(r.maxUnitPriceInclusiveCents)) {
      openEndedCount += 1;
      if (i !== sorted.length - 1) {
        return "Only the last band may use the open-ended ceiling.";
      }
    }
    if (r.minUnitPriceInclusiveCents < 1) {
      return "Each band’s “from” amount must be at least $0.01.";
    }
    if (!isOpenEndedMax(r.maxUnitPriceInclusiveCents)) {
      if (r.minUnitPriceInclusiveCents > r.maxUnitPriceInclusiveCents) {
        return `"From" cannot be greater than “through” on the same row.`;
      }
    } else if (r.minUnitPriceInclusiveCents >= r.maxUnitPriceInclusiveCents) {
      return "The open-ended band’s “from” must be below the system ceiling.";
    }
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (r.minUnitPriceInclusiveCents !== prev.maxUnitPriceInclusiveCents + 1) {
        return `After ${formatUsdFromCents(prev.maxUnitPriceInclusiveCents)}, the next band must start at ${formatUsdFromCents(prev.maxUnitPriceInclusiveCents + 1)} (one cent above the previous “through”).`;
      }
      if (
        !isOpenEndedMax(r.maxUnitPriceInclusiveCents) &&
        r.maxUnitPriceInclusiveCents <= prev.maxUnitPriceInclusiveCents
      ) {
        return "Each band’s “through” must be greater than the previous band’s “through”.";
      }
    }
  }
  if (openEndedCount > 1) {
    return "At most one band may use the open-ended ceiling.";
  }
  if (
    sorted.length > 0 &&
    !isOpenEndedMax(sorted[sorted.length - 1]!.maxUnitPriceInclusiveCents)
  ) {
    return "The last band should use the open-ended ceiling (very high “through”) so every unit price is covered.";
  }
  return null;
}

export function patchMaxAndSyncNextMin(
  rows: FeeTierFormRow[],
  target: FeeTierFormRow,
  newMax: number,
): FeeTierFormRow[] {
  const sorted = sortTierRows(rows);
  const si = sorted.findIndex((r) => r === target);
  if (si < 0) return sortTierRows(rows);
  const next = sorted[si + 1];
  return sortTierRows(
    rows.map((r) => {
      if (r === target) return { ...r, maxUnitPriceInclusiveCents: newMax };
      if (next && r === next) {
        return { ...r, minUnitPriceInclusiveCents: newMax + 1 };
      }
      return r;
    }),
  );
}

export function formRowsToServerPayload(
  rows: FeeTierFormRow[],
): FeeTierServerPayload[] {
  return sortTierRows(rows).map((t) => ({
    maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
    feePerUnitCents: t.feePerUnitCents,
  }));
}

export function addTierRow(rows: FeeTierFormRow[]): FeeTierFormRow[] {
  const sorted = sortTierRows(rows);
  const last = sorted[sorted.length - 1];
  if (last && isOpenEndedMax(last.maxUnitPriceInclusiveCents)) {
    const penult = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const base = penult?.maxUnitPriceInclusiveCents ?? 0;
    const newMax = base + 10_000;
    const newMin = base + 1;
    return sortTierRows([
      ...rows.map((r) =>
        r === last ? { ...r, minUnitPriceInclusiveCents: newMax + 1 } : { ...r },
      ),
      {
        minUnitPriceInclusiveCents: newMin,
        maxUnitPriceInclusiveCents: newMax,
        feePerUnitCents: 0,
      },
    ]);
  }
  if (!last) {
    return sortTierRows([
      ...rows,
      {
        minUnitPriceInclusiveCents: 1,
        maxUnitPriceInclusiveCents: 2000,
        feePerUnitCents: 0,
      },
    ]);
  }
  const nextMin = last.maxUnitPriceInclusiveCents + 1;
  const nextMax = last.maxUnitPriceInclusiveCents + 10_000;
  return sortTierRows([
    ...rows,
    {
      minUnitPriceInclusiveCents: nextMin,
      maxUnitPriceInclusiveCents: nextMax,
      feePerUnitCents: 0,
    },
  ]);
}

export function removeTierRow(
  rows: FeeTierFormRow[],
  row: FeeTierFormRow,
): FeeTierFormRow[] {
  const filtered = sortTierRows(rows.filter((r) => r !== row));
  if (filtered.length === 0) return filtered;
  return filtered.map((r, i) =>
    i === 0 ?
      { ...r, minUnitPriceInclusiveCents: 1 }
    : {
        ...r,
        minUnitPriceInclusiveCents: filtered[i - 1]!.maxUnitPriceInclusiveCents + 1,
      },
  );
}
