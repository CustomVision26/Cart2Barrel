import type {
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  buildOutsidePurchaseLifecycleEvents,
} from "@/lib/outside-purchase-lifecycle";
import {
  latestTrackedFulfillmentSnapshot,
  productHistoryLabelFromSnapshot,
  TRACKED_FULFILLMENT_PHASES,
} from "@/lib/product-history-fulfillment";
import { resolveProductHistoryStatusDisplay } from "@/lib/product-history-status";

export type ProductHistoryTimelineEvent = {
  id: string;
  label: string;
  headline: string;
  detail: string;
  at: string;
  kind: "snapshot" | "current";
  snapshot?: ItemRequestLineSnapshot;
  prevSnapshot?: ItemRequestLineSnapshot | null;
  highlight?: boolean;
};

export function buildProductHistoryTimelineEvents(
  request: ItemRequest,
  snapshots: ItemRequestLineSnapshot[],
  quotesById: Map<string, ItemQuote>,
  options?: {
    fulfillmentLabelOverride?: string | null;
    returnRequest?: OutsidePurchaseReturnRequest | null;
  },
): ProductHistoryTimelineEvent[] {
  const outsidePurchase = isOutsidePurchaseRequest(request);
  const lifecycleBySnapshotId = new Map(
    (outsidePurchase ?
      buildOutsidePurchaseLifecycleEvents(request, snapshots)
    : []
    ).map((event) => [event.id, event]),
  );

  const events: ProductHistoryTimelineEvent[] = snapshots.map((snap, index) => {
    const previous = index > 0 ? snapshots[index - 1]! : null;
    const lifecycle = lifecycleBySnapshotId.get(snap.id);
    const quote = snap.itemQuoteId ? quotesById.get(snap.itemQuoteId) : null;

    const label =
      lifecycle ? "Outside purchase status" : itemRequestLineSnapshotPhaseLabel(snap.phase);
    const headline =
      lifecycle?.title ??
      (TRACKED_FULFILLMENT_PHASES.has(snap.phase) ?
        productHistoryLabelFromSnapshot(snap)
      : auditSnapshotStatusHeadline(snap));
    const detail =
      lifecycle?.detail && lifecycle.detail !== lifecycle.title ?
        lifecycle.detail
      : auditSnapshotChangeSummary(snap, previous);

    return {
      id: snap.id,
      label,
      headline,
      detail:
        quote && !detail.includes(formatUsdHint(quote)) ?
          `${detail}${detail.endsWith(".") ? "" : "."} Linked estimate total ${formatQuoteTotal(quote)}.`
        : detail,
      at: snap.createdAt,
      kind: "snapshot",
      snapshot: snap,
      prevSnapshot: previous,
      highlight: Boolean(lifecycle),
    };
  });

  const statusDisplay = resolveProductHistoryStatusDisplay(request, snapshots, {
    fulfillmentLabelOverride: options?.fulfillmentLabelOverride,
    returnRequest: options?.returnRequest,
  });
  const latestAt =
    latestTrackedFulfillmentSnapshot(snapshots)?.createdAt ??
    snapshots.at(-1)?.createdAt ??
    request.createdAt;

  events.push({
    id: `current:${request.id}`,
    label: "Current status",
    headline: statusDisplay.label,
    detail:
      request.status === "withdrawn"
        ? "This product was removed from Active and is kept here for your records."
        : "Latest status shown for this product line.",
    at: latestAt,
    kind: "current",
  });

  return events;
}

function formatQuoteTotal(quote: ItemQuote): string {
  const dollars = (quote.totalPrice / 100).toFixed(2);
  return `$${dollars}`;
}

function formatUsdHint(quote: ItemQuote): string {
  return formatQuoteTotal(quote);
}
