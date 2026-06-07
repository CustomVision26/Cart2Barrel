/**
 * Split an integer cent `total` across lines weighted by `weights`, using the
 * largest-remainder (Hamilton) method so the allocations sum back to `total`
 * exactly. Falls back to an even split when every weight is zero.
 */
export function allocateCentsByWeight(
  total: number,
  weights: number[],
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeWeights = weights.map((w) => (w > 0 ? w : 0));
  const weightSum = safeWeights.reduce((a, b) => a + b, 0);

  if (weightSum <= 0) {
    const base = Math.floor(total / n);
    const out = new Array<number>(n).fill(base);
    let remainder = total - base * n;
    for (let i = 0; i < n && remainder > 0; i++) {
      out[i] += 1;
      remainder -= 1;
    }
    return out;
  }

  const exact = safeWeights.map((w) => (total * w) / weightSum);
  const out = exact.map((x) => Math.floor(x));
  let remainder = total - out.reduce((a, b) => a + b, 0);
  const byFraction = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byFraction.length && remainder > 0; k++) {
    out[byFraction[k].i] += 1;
    remainder -= 1;
  }
  return out;
}
