import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Drizzle over `@neondatabase/serverless` HTTP — `.transaction()` is not supported. */
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!db) {
    const sql = neon(process.env.DATABASE_URL);
    db = drizzle({ client: sql, schema });
  }
  return db;
}

export { schema };
