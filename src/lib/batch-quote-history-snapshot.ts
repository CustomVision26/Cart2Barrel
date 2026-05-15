import type {
  BatchQuoteEstimate,
  BatchQuoteSession,
  BatchQuoteSessionEventKind,
  ItemRequest,
} from "@/db/schema";
import { batchQuoteSessionEventKindLabel } from "@/lib/batch-quote-session-status-labels";
import {
  BATCH_QUOTE_HISTORY_SNAPSHOT_V,
  type BatchQuoteHistorySnapshot,
} from "@/types/batch-quote-history-snapshot";

function sessionStatusAfterKind(kind: BatchQuoteSessionEventKind): string {
  switch (kind) {
    case "new_batch_request":
    case "revision_reopened":
      return "submitted";
    case "quoted_batch":
    case "returned_to_quoted_batch":
      return "estimated";
    case "in_cart":
      return "in_cart";
    case "paid_pending_staff_purchase":
      return "paid_pending_staff_purchase";
    default:
      return "unknown";
  }
}

function linesFromRequests(requests: ItemRequest[]) {
  return requests.map(
    (r): BatchQuoteHistorySnapshot["lines"][number] => ({
      productName: r.productName,
      productUrl: r.productUrl,
      siteName: r.siteName,
      productImageUrl: r.productImageUrl,
    }),
  );
}

function estimateSnapshot(
  row: BatchQuoteEstimate | null,
): BatchQuoteHistorySnapshot["estimate"] {
  if (!row) return null;
  return {
    id: row.id,
    subtotalCents: row.subtotalCents,
    savedAt: row.createdAt,
  };
}

export function buildBatchQuoteHistorySnapshot(params: {
  kind: BatchQuoteSessionEventKind;
  session: BatchQuoteSession;
  requests: ItemRequest[];
  estimate: BatchQuoteEstimate | null;
  orderId?: string;
}): BatchQuoteHistorySnapshot {
  const { kind, session, requests, estimate, orderId } = params;
  return {
    v: BATCH_QUOTE_HISTORY_SNAPSHOT_V,
    kind,
    stageLabel: batchQuoteSessionEventKindLabel(kind),
    batchNumber: session.batchNumber,
    siteKey: session.siteKey,
    sessionStatus: sessionStatusAfterKind(kind),
    submittedAt: session.submittedAt,
    cartAcceptanceAcceptedAt: session.cartAcceptanceAcceptedAt,
    estimate: estimateSnapshot(estimate),
    lines: linesFromRequests(requests),
    ...(orderId ? { orderId } : {}),
  };
}
