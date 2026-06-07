"use client";

import { useMemo } from "react";

import { AdminSavedQuotePreviewDialog } from "@/components/admin/admin-saved-quote-preview-dialog";
import {
  ProductHistoryEventPreviewDialog,
  type ProductHistoryTimelinePreview,
} from "@/components/dashboard/product-history-event-preview-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { ItemQuote, ItemRequest, ItemRequestLineSnapshot, OutsidePurchaseReturnRequest } from "@/db/schema";
import { quotesForRequestFromHistoryLines } from "@/lib/admin-quote-history-display";
import type { AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import {
  itemRequestStatusBadgeKindForDisplay,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
import {
  buildProductHistoryTimelineEvents,
  type ProductHistoryTimelineEvent,
} from "@/lib/product-history-timeline";
import { cn } from "@/lib/utils";

function timelineEventPreview(
  event: ProductHistoryTimelineEvent,
  request: ItemRequest,
  statusLabel: string,
  warehouseProofPhotoUrls?: string[] | null,
): ProductHistoryTimelinePreview {
  if (event.kind === "snapshot" && event.snapshot) {
    return {
      kind: "snapshot",
      snapshot: event.snapshot,
      prevSnapshot: event.prevSnapshot ?? null,
      warehouseProofPhotoUrls,
    };
  }
  return { kind: "current", request, statusLabel };
}

function QuoteHistoryTimelinePreviewButton({
  event,
  request,
  statusLabel,
  quotesById,
  orderContext,
}: {
  event: ProductHistoryTimelineEvent;
  request: ItemRequest;
  statusLabel: string;
  quotesById: Map<string, ItemQuote>;
  orderContext?: ItemRequestOrderContext | null;
}) {
  const linkedQuoteId = event.snapshot?.itemQuoteId ?? null;
  const linkedQuote = linkedQuoteId ? quotesById.get(linkedQuoteId) : null;
  if (linkedQuote) {
    return (
      <AdminSavedQuotePreviewDialog quote={linkedQuote} request={request} label="Preview" />
    );
  }
  return (
    <ProductHistoryEventPreviewDialog
      eventLabel={event.label}
      eventHeadline={event.headline}
      preview={timelineEventPreview(
        event,
        request,
        statusLabel,
        event.snapshot?.phase === "warehouse_delivery_received" ?
          orderContext?.orderItem.warehouseReceivedProofPhotoUrls ?? null
        : null,
      )}
    />
  );
}

export function AdminQuoteHistoryProductTimelineTable({
  request,
  allGroupLines,
  snapshots,
  returnRequest = null,
  orderContext,
}: {
  request: ItemRequest;
  allGroupLines: AdminQuoteHistoryLine[];
  snapshots: ItemRequestLineSnapshot[];
  returnRequest?: OutsidePurchaseReturnRequest | null;
  orderContext?: ItemRequestOrderContext | null;
}) {
  const statusLabel = itemRequestStatusLabelForDisplay(
    request,
    returnRequest,
    orderContext,
    "admin",
    snapshots,
  );
  const quotes = useMemo(
    () => quotesForRequestFromHistoryLines(allGroupLines, request.id),
    [allGroupLines, request.id],
  );
  const quotesById = useMemo(
    () => new Map(quotes.map((quote) => [quote.id, quote])),
    [quotes],
  );
  const events = useMemo(() => {
    const built = buildProductHistoryTimelineEvents(request, snapshots, quotesById, {
      returnRequest,
      orderContext,
      audience: "admin",
    });
    return [...built].reverse();
  }, [request, snapshots, quotesById, returnRequest, orderContext]);

  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-sky-500/30 bg-sky-500/[0.06] px-3 py-4 text-xs text-muted-foreground ring-1 ring-sky-500/15">
        No status records were saved for this product yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-sky-500/30 bg-sky-950/15 shadow-sm ring-1 ring-sky-500/15 dark:bg-sky-500/[0.06]">
      <p className="border-b border-sky-500/20 bg-sky-500/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
        Status history — newest to oldest
      </p>
      <table className="w-full min-w-[36rem] text-left text-xs sm:text-sm">
        <thead className="border-b border-sky-500/15 bg-sky-500/[0.06]">
          <tr>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Stage</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted-foreground">
              When
            </th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Preview</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sky-500/10">
          {events.map((event) => (
            <tr
              key={event.id}
              className={cn(
                event.kind === "current" &&
                  "bg-sky-500/10 shadow-[inset_3px_0_0_rgb(56_189_248_/_0.75)]",
                event.kind !== "current" && "hover:bg-sky-500/[0.04]",
              )}
            >
              <td className="px-4 py-3 align-top text-muted-foreground">{event.label}</td>
              <td className="max-w-[18rem] px-4 py-3 align-top">
                {event.kind === "current" ?
                  <StatusBadge
                    kind={itemRequestStatusBadgeKindForDisplay(
                      request,
                      returnRequest,
                      orderContext,
                      "admin",
                      snapshots,
                    )}
                    className="whitespace-normal leading-snug"
                  >
                    {event.headline}
                  </StatusBadge>
                : <div className="space-y-1">
                    <p className="font-semibold leading-snug text-foreground">
                      {event.headline}
                    </p>
                    {event.detail ?
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {event.detail}
                      </p>
                    : null}
                  </div>
                }
                {event.kind === "current" ?
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {event.detail}
                  </p>
                : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums text-muted-foreground">
                <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
              </td>
              <td className="px-4 py-3 align-top">
                <QuoteHistoryTimelinePreviewButton
                  event={event}
                  request={request}
                  statusLabel={statusLabel}
                  quotesById={quotesById}
                  orderContext={orderContext}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
