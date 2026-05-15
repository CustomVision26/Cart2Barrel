/**
 * Split a bundle subtotal across line items for internal order rows (sum matches
 * `bundleSubtotalCents`). Allocation is proportional to prior `lineTotalCents` weights.
 */
export function allocateBundleSubtotalAcrossLineTotalsCents(
  lineTotalCents: number[],
  bundleSubtotalCents: number,
): number[] {
  if (lineTotalCents.length === 0) return [];
  if (bundleSubtotalCents <= 0) {
    return lineTotalCents.map(() => 0);
  }
  const weights = lineTotalCents.map((t) => Math.max(1, t > 0 ? t : 1));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const alloc = weights.map((w) =>
    Math.floor((bundleSubtotalCents * w) / sumW),
  );
  let diff = bundleSubtotalCents - alloc.reduce((a, b) => a + b, 0);
  let i = 0;
  while (diff > 0) {
    alloc[i % alloc.length] += 1;
    diff -= 1;
    i += 1;
  }
  return alloc;
}
