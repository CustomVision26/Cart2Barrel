/** True when Postgres reports the spotlight variants table is missing. */
export function isMissingSpotlightVariantsTableError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  return (
    lower.includes("spotlight_product_variants") &&
    (lower.includes("does not exist") ||
      lower.includes("relation") ||
      lower.includes("failed query"))
  );
}
