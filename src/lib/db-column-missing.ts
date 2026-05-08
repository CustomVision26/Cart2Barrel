/** Postgres undefined_column */
const PG_UNDEFINED_COLUMN = "42703";

function errorChain(e: unknown): unknown[] {
  const out: unknown[] = [];
  let cur: unknown = e;
  const seen = new Set<unknown>();
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    if (typeof cur === "object" && cur !== null && "cause" in cur) {
      cur = (cur as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return out;
}

function chainMessage(e: unknown): string {
  return errorChain(e)
    .map((x) => (x instanceof Error ? x.message : String(x)))
    .join(" ");
}

export function getPgErrorCode(e: unknown): string | undefined {
  for (const link of errorChain(e)) {
    if (typeof link === "object" && link !== null && "code" in link) {
      const c = (link as { code: unknown }).code;
      if (typeof c === "string" && c.length > 0) return c;
    }
  }
  return undefined;
}

export function combinedErrorText(e: unknown): string {
  return chainMessage(e);
}

/**
 * True when the failure is almost certainly a missing DB column (migrations not applied).
 * Drizzle/Neon may wrap the driver error; we inspect the full cause chain.
 */
export function isUndefinedColumnError(e: unknown, columnHint: string): boolean {
  const hint = columnHint.toLowerCase();
  const combined = chainMessage(e).toLowerCase();
  if (!combined.includes(hint)) return false;

  for (const link of errorChain(e)) {
    if (typeof link === "object" && link !== null && "code" in link) {
      if (String((link as { code: unknown }).code) === PG_UNDEFINED_COLUMN) {
        return true;
      }
    }
  }

  return (
    /does not exist/i.test(combined) ||
    /undefined column/i.test(combined) ||
    /\b42703\b/.test(combined) ||
    (/failed query/i.test(combined) && combined.includes(hint))
  );
}
