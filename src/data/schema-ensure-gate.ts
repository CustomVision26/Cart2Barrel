import "server-only";

/**
 * Runtime schema-ensure helpers issue one Neon HTTP round-trip per DDL statement.
 * Module-level `ready` flags reset on Next.js HMR, so local pages re-run
 * ALTER/CREATE on almost every request (homepage hub-stock alone is ~25 statements).
 *
 * Flags live on `globalThis` so they survive HMR. Development skips DDL unless
 * `ENSURE_DB_SCHEMA=1` — use `npm run db:push` for schema changes instead.
 */

type EnsureStatus = "ready";

const g = globalThis as typeof globalThis & {
  __c2bSchemaEnsure?: Record<string, EnsureStatus>;
};

function statusMap(): Record<string, EnsureStatus> {
  g.__c2bSchemaEnsure ??= {};
  return g.__c2bSchemaEnsure;
}

export function skipRuntimeSchemaEnsure(): boolean {
  const force =
    process.env.ENSURE_DB_SCHEMA === "1" ||
    process.env.ENSURE_DB_SCHEMA === "true";
  if (force) return false;
  return process.env.NODE_ENV !== "production";
}

export function markSchemaEnsureReady(key: string): void {
  statusMap()[key] = "ready";
}

export function markSchemaEnsureFailed(key: string): void {
  delete statusMap()[key];
}

/** True when the caller should return immediately (already done this process, or skipped in dev). */
export function schemaEnsureFastPath(key: string): boolean {
  if (statusMap()[key] === "ready") return true;
  if (skipRuntimeSchemaEnsure()) {
    markSchemaEnsureReady(key);
    return true;
  }
  return false;
}
