import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let attempted = false;
let ready = false;

/** Adds `page_visits` when Drizzle schema is ahead of Neon (idempotent). */
export async function ensurePageVisitsSchema(): Promise<boolean> {
  if (ready) return true;
  if (attempted) return ready;
  attempted = true;

  try {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "page_visits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "visitor_id" uuid NOT NULL,
        "clerk_user_id" text,
        "path" text NOT NULL,
        "referrer" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "page_visits_visitor_created_idx"
      ON "page_visits" USING btree ("visitor_id", "created_at")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "page_visits_user_created_idx"
      ON "page_visits" USING btree ("clerk_user_id", "created_at")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "page_visits_path_created_idx"
      ON "page_visits" USING btree ("path", "created_at")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "page_visits_created_idx"
      ON "page_visits" USING btree ("created_at")
    `);
    ready = true;
    return true;
  } catch (error) {
    attempted = false;
    ready = false;
    console.warn(
      "[Amani Cart2Barrel] page_visits schema ensure failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
