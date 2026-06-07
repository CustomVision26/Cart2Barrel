import type {
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { ItemRequestProductStatusAudience } from "@/lib/outside-purchase-product-status";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import type { BatchLineShare } from "@/lib/batch-line-share";
import {
  chronologicalPreviousSnapshot,
  filterSnapshotsForProductTracking,
  quoteAtOrBeforeSnapshot,
  shouldShowBatchEstimateShareForSnapshotPhase,
  shouldShowSingleQuoteBreakdownForSnapshotPhase,
  snapshotPhaseDisplayLabel,
} from "@/lib/snapshot-tracking-display";
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
  /** Modal title when different from the status headline (outside-purchase lifecycle). */
  modalTitle?: string;
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
    orderContext?: ItemRequestOrderContext | null;
    audience?: ItemRequestProductStatusAudience;
    /** Hide transient "Before estimate save (staff)" rows from the event list. */
    hidePreEstimateEditEvents?: boolean;
    /** Product belongs to a batch with a saved estimate (checkout label + share). */
    isBatchedProduct?: boolean;
    /** Per-product slice of the saved batch estimate (for checkout detail lines). */
    batchShare?: BatchLineShare | null;
    /** Omit the synthetic "Current status" row (duplicates the latest snapshot). */
    hideCurrentStatusEvent?: boolean;
  },
): ProductHistoryTimelineEvent[] {
  const outsidePurchase = isOutsidePurchaseRequest(request);
  const lifecycleBySnapshotId = new Map(
    (outsidePurchase ?
      buildOutsidePurchaseLifecycleEvents(request, snapshots)
    : []
    ).map((event) => [event.id, event]),
  );

  const eventSnapshots = filterSnapshotsForProductTracking(snapshots, {
    hidePreEstimateEditEvents: options?.hidePreEstimateEditEvents,
    isBatchedProduct: options?.isBatchedProduct,
  });
  const allQuotes = [...quotesById.values()];

  const events: ProductHistoryTimelineEvent[] = eventSnapshots.map((snap) => {
    const previous = chronologicalPreviousSnapshot(snap, snapshots);
    const lifecycle = lifecycleBySnapshotId.get(snap.id);
    const quote =
      snap.itemQuoteId ?
        (quotesById.get(snap.itemQuoteId) ?? null)
      : shouldShowSingleQuoteBreakdownForSnapshotPhase(snap.phase) ?
        quoteAtOrBeforeSnapshot(snap, allQuotes)
      : null;

    const label =
      lifecycle ?
        snap.phase === "outside_purchase_checkout_paid" ?
          snapshotPhaseDisplayLabel(snap.phase, {
            isBatchedProduct: options?.isBatchedProduct,
          })
        : "Outside purchase status"
      : snapshotPhaseDisplayLabel(snap.phase, {
          isBatchedProduct: options?.isBatchedProduct,
        });
    const headline =
      lifecycle &&
      (snap.phase === "outside_purchase_published" ||
        snap.phase === "outside_purchase_intake") ?
        auditSnapshotStatusHeadline(snap, {
          snapshots,
          quoteStaffNote: quote?.staffNote ?? null,
          receivedConditionRaw: request.outsidePurchaseReceivedCondition,
        })
      : lifecycle?.title ??
        (TRACKED_FULFILLMENT_PHASES.has(snap.phase) ?
          productHistoryLabelFromSnapshot(snap)
        : auditSnapshotStatusHeadline(snap, {
            snapshots,
            quoteStaffNote: quote?.staffNote ?? null,
            receivedConditionRaw: request.outsidePurchaseReceivedCondition,
          }));
    const modalTitle =
      lifecycle &&
      (snap.phase === "outside_purchase_published" ||
        snap.phase === "outside_purchase_intake") ?
        lifecycle.title
      : undefined;
    const detail =
      lifecycle?.detail && lifecycle.detail !== lifecycle.title ?
        lifecycle.detail
      : auditSnapshotChangeSummary(snap, previous);

    const showBatchShareTotal =
      options?.isBatchedProduct &&
      options.batchShare != null &&
      shouldShowBatchEstimateShareForSnapshotPhase(snap.phase);
    let detailWithPricing = detail;
    if (showBatchShareTotal && options.batchShare) {
      const shareHint = formatBatchShareTotal(options.batchShare);
      if (!detail.includes(shareHint)) {
        detailWithPricing = `${detail}${detail.endsWith(".") ? "" : "."} Batch estimate share total ${shareHint}.`;
      }
    } else if (quote && !detail.includes(formatUsdHint(quote))) {
      detailWithPricing = `${detail}${detail.endsWith(".") ? "" : "."} Linked estimate total ${formatQuoteTotal(quote)}.`;
    }

    return {
      id: snap.id,
      label,
      headline,
      modalTitle,
      detail: detailWithPricing,
      at: snap.createdAt,
      kind: "snapshot",
      snapshot: snap,
      prevSnapshot: chronologicalPreviousSnapshot(snap, snapshots),
      highlight: Boolean(lifecycle),
    };
  });

  if (!options?.hideCurrentStatusEvent) {
    const statusDisplay = resolveProductHistoryStatusDisplay(request, snapshots, {
      fulfillmentLabelOverride: options?.fulfillmentLabelOverride,
      returnRequest: options?.returnRequest,
      orderContext: options?.orderContext,
      audience: options?.audience,
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
  }

  return events;
}

function formatQuoteTotal(quote: ItemQuote): string {
  const dollars = (quote.totalPrice / 100).toFixed(2);
  return `$${dollars}`;
}

function formatUsdHint(quote: ItemQuote): string {
  return formatQuoteTotal(quote);
}

function formatBatchShareTotal(share: BatchLineShare): string {
  const dollars = (share.total / 100).toFixed(2);
  return `$${dollars}`;
}
