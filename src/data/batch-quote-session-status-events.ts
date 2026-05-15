import { asc, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  combinedErrorText,
  shouldBestEffortSkipBatchQuoteSessionStatusEventWrite,
} from "@/lib/db-column-missing";
import {
  batchQuoteSessionStatusEvents,
  type BatchQuoteSessionEventKind,
} from "@/db/schema";
import type { BatchQuoteSessionStatusEventDetail } from "@/types/batch-quote-history-snapshot";

export type BatchQuoteSessionStatusEventRow =
  typeof batchQuoteSessionStatusEvents.$inferSelect;

export async function listBatchQuoteSessionStatusEventsForSessions(params: {
  sessionIds: string[];
}): Promise<BatchQuoteSessionStatusEventRow[]> {
  const ids = [...new Set(params.sessionIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const db = getDb();
  try {
    return await db
      .select()
      .from(batchQuoteSessionStatusEvents)
      .where(inArray(batchQuoteSessionStatusEvents.batchQuoteSessionId, ids))
      .orderBy(asc(batchQuoteSessionStatusEvents.createdAt));
  } catch (e) {
    if (!shouldBestEffortSkipBatchQuoteSessionStatusEventWrite(e)) throw e;

    console.warn(
      "[Cart2Barrel] Omitting batch_quote_session_status_events SELECT (migrate DB).\n",
      combinedErrorText(e),
      "\nApply schema: npm run db:push (DATABASE_URL)."
    );
    return [];
  }
}

export async function appendBatchQuoteSessionStatusEvent(params: {
  batchQuoteSessionId: string;
  clerkUserId: string;
  kind: BatchQuoteSessionEventKind;
  detail?: BatchQuoteSessionStatusEventDetail | null;
}): Promise<void> {
  const db = getDb();
  try {
    await db.insert(batchQuoteSessionStatusEvents).values({
      batchQuoteSessionId: params.batchQuoteSessionId,
      clerkUserId: params.clerkUserId,
      kind: params.kind,
      detail: params.detail ?? null,
    });
  } catch (e) {
    if (!shouldBestEffortSkipBatchQuoteSessionStatusEventWrite(e)) throw e;

    console.warn(
      "[Cart2Barrel] Skipping batch_quote_session_status_events insert (migrate DB).\n",
      combinedErrorText(e),
      "\nApply schema: npm run db:push (DATABASE_URL),\nOr in Neon SQL: ALTER TYPE batch_quote_session_status_event_kind ADD VALUE IF NOT EXISTS 'returned_to_quoted_batch'; (and rerun db:push so the audit table/types match Drizzle)."
    );
  }
}
