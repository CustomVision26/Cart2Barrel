import { neon } from "@neondatabase/serverless";

let neonSql: ReturnType<typeof neon> | null = null;

/** Shared Neon HTTP driver for narrow SQL fallbacks when Drizzle targets columns missing from DB. */
export function getNeonSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!neonSql) {
    neonSql = neon(url);
  }
  return neonSql;
}
