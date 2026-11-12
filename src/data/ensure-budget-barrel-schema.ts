import "server-only";

import { sql } from "drizzle-orm";

import {
  isSchemaEnsureReady,
  markSchemaEnsureFailed,
  markSchemaEnsureReady,
} from "@/data/schema-ensure-gate";
import { getDb } from "@/db";

const ENSURE_KEY = "budget-barrel-drafts-v1";

let inFlight: Promise<boolean> | null = null;

/** Creates Budget Barrel drafts when Drizzle schema is ahead of Neon. */
export async function ensureBudgetBarrelSchema(): Promise<boolean> {
  if (isSchemaEnsureReady(ENSURE_KEY)) return true;
  if (inFlight) return inFlight;
  inFlight = ensureBudgetBarrelSchemaInner().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function ensureBudgetBarrelSchemaInner(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "budget_barrel_drafts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clerk_user_id" text NOT NULL REFERENCES "profiles"("clerk_user_id") ON DELETE cascade,
        "status" text DEFAULT 'open' NOT NULL,
        "idempotency_key" text,
        "merchandise_budget_cents" integer NOT NULL,
        "request" jsonb NOT NULL,
        "offers" jsonb NOT NULL,
        "one_store" jsonb,
        "multi_store" jsonb,
        "provider_notes" jsonb NOT NULL,
        "price_checked_at" timestamp with time zone NOT NULL,
        "shopping_list_quote_id" uuid,
        "batch_quote_session_id" uuid,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "budget_barrel_drafts_clerk_user_id_idx"
      ON "budget_barrel_drafts" ("clerk_user_id")
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "budget_barrel_drafts_user_idempotency_uidx"
      ON "budget_barrel_drafts" ("clerk_user_id", "idempotency_key")
    `);
    markSchemaEnsureReady(ENSURE_KEY);
    return true;
  } catch (error) {
    markSchemaEnsureFailed(ENSURE_KEY);
    console.warn(
      "[Amani Cart2Barrel] budget_barrel_drafts schema ensure failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
