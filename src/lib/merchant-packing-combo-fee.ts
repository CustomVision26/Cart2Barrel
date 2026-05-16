/** One configured total fee for a (barrel count, bin count) mix. */
export type PackingComboFeeRow = {
  barrelCount: number;
  binCount: number;
  feeCents: number;
};

/**
 * Returns the exact-match fee in cents, or `null` if no row matches.
 * `barrelTotal` / `binTotal` are total container quantities by kind (e.g. sum of line qty).
 */
export function packingComboFeeCents(
  combos: readonly PackingComboFeeRow[] | null | undefined,
  barrelTotal: number,
  binTotal: number,
): number | null {
  if (!combos || combos.length === 0) return null;
  const b = Math.max(0, Math.floor(barrelTotal));
  const n = Math.max(0, Math.floor(binTotal));
  const row = combos.find((c) => c.barrelCount === b && c.binCount === n);
  return row != null ? row.feeCents : null;
}
