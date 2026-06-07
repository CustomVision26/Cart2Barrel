"use client";

import { ChevronDown, ExternalLinkIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  ProductHistoryEventPreviewDialog,
  type ProductHistoryTimelinePreview,
} from "@/components/dashboard/product-history-event-preview-dialog";
import type { ReceivedProductPhoto } from "@/components/orders/item-request-line-snapshot-preview-panel";
import { ReceivedPhotosViewer } from "@/components/orders/received-photos-viewer";
import type {
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { BatchLineShare } from "@/lib/batch-line-share";
import { quoteForSnapshotPreview } from "@/lib/snapshot-tracking-display";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { outsidePurchaseReferenceLabel } from "@/lib/outside-purchase-lifecycle";
import { outsidePurchaseConditionPhotosFromRequest } from "@/lib/outside-purchase-condition-images";
import {
  buildProductHistoryTimelineEvents,
  type ProductHistoryTimelineEvent,
} from "@/lib/product-history-timeline";
import {
  dashItemsTableEmpty,
  dashItemsTimelineCard,
} from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

const trackRecordHeaderLinkClassName =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 sm:text-sm";

function ToggleSection({
  title,
  summary,
  children,
  defaultOpen = true,
  className,
  bodyClassName,
  ariaLabel,
}: {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border", className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted px-3 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-card text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">{title}</div>
          {summary ?
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {summary}
            </div>
          : null}
        </div>
      </div>
      {open ? <div className={cn("p-3", bodyClassName)}>{children}</div> : null}
    </section>
  );
}

function eventPreview(
  event: ProductHistoryTimelineEvent,
  request: ItemRequest,
  statusLabel: string,
  quotes: ItemQuote[],
  batchShare: BatchLineShare | null,
  batchEstimateNote: string | null,
  warehouseProofPhotoUrls?: string[] | null,
  receivedProductPhotos?: ReceivedProductPhoto[] | null,
  snapshots?: readonly ItemRequestLineSnapshot[],
): ProductHistoryTimelinePreview {
  if (event.kind === "snapshot" && event.snapshot) {
    const linkedQuote = quoteForSnapshotPreview(event.snapshot, quotes);
    return {
      kind: "snapshot",
      snapshot: event.snapshot,
      prevSnapshot: event.prevSnapshot ?? null,
      warehouseProofPhotoUrls,
      receivedProductPhotos,
      receiptPhotoUrl: request.outsidePurchaseReceiptImageUrl,
      productImageUrl: request.productImageUrl,
      estimateNote: linkedQuote?.staffNote ?? null,
      estimateTotalCents: linkedQuote?.totalPrice ?? null,
      estimateQuote: linkedQuote,
      batchShare,
      batchEstimateNote,
      isBatchedProduct: batchShare != null,
      auditSnapshots: snapshots ?? null,
      receivedConditionRaw: request.outsidePurchaseReceivedCondition,
    };
  }
  return { kind: "current", request, statusLabel };
}

export function ProductHistoryTrackRecord({
  request,
  snapshots,
  quotes,
  batchShare = null,
  batchEstimateNote = null,
  fulfillmentLabelOverride,
  returnRequest,
  orderContext,
  statusLabel,
  defaultOpen = true,
}: {
  request: ItemRequest;
  snapshots: ItemRequestLineSnapshot[];
  quotes: ItemQuote[];
  /** This product's batch estimate share; replaces single estimate when batched. */
  batchShare?: BatchLineShare | null;
  /** Batch estimate note (staff) shown when this product is batched. */
  batchEstimateNote?: string | null;
  fulfillmentLabelOverride?: string | null;
  returnRequest?: OutsidePurchaseReturnRequest | null;
  orderContext?: ItemRequestOrderContext | null;
  statusLabel: string;
  defaultOpen?: boolean;
}) {
  const quotesById = useMemo(
    () => new Map(quotes.map((quote) => [quote.id, quote])),
    [quotes],
  );
  const outsidePurchase = isOutsidePurchaseRequest(request);
  const events = useMemo(() => {
    const built = buildProductHistoryTimelineEvents(request, snapshots, quotesById, {
      fulfillmentLabelOverride,
      returnRequest,
      orderContext,
      audience: "customer",
      hidePreEstimateEditEvents: true,
      isBatchedProduct: batchShare != null,
      batchShare,
      hideCurrentStatusEvent: true,
    });
    return [...built].reverse();
  }, [
      request,
      snapshots,
      quotesById,
      batchShare,
      fulfillmentLabelOverride,
      returnRequest,
      orderContext,
  ]);
  const opRef = outsidePurchase ? outsidePurchaseReferenceLabel(request) : null;
  const conditionPhotos = outsidePurchase
    ? outsidePurchaseConditionPhotosFromRequest(request)
    : [];
  const receivedProductPhotos = outsidePurchase ? conditionPhotos : null;
  const receiptPhotoUrl = request.outsidePurchaseReceiptImageUrl?.trim() || null;
  const productUrl = request.productUrl?.trim() || null;

  if (events.length === 0) {
    return (
      <p className={cn(dashItemsTimelineCard, "text-sm text-muted-foreground")}>
        No status records were saved for this product yet.
      </p>
    );
  }

  return (
    <ToggleSection
      ariaLabel="Toggle track record log for this product"
      title={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-semibold text-foreground">Track record log</span>
          {outsidePurchase ?
            <>
              {receiptPhotoUrl ?
                <ReceivedPhotosViewer
                  photos={[{ url: receiptPhotoUrl, label: "Receipt" }]}
                  triggerLabel="Receipt"
                />
              : null}
              {conditionPhotos.length > 0 ?
                <ReceivedPhotosViewer
                  photos={conditionPhotos}
                  triggerLabel="Received condition photo"
                />
              : null}
            </>
          : productUrl ?
            <div className="inline-flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Product URL
              </span>
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={trackRecordHeaderLinkClassName}
                title={productUrl}
              >
                Open link
                <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
              </a>
            </div>
          : null}
        </div>
      }
      summary={
        outsidePurchase && opRef ?
          `${events.length} status event${events.length === 1 ? "" : "s"} · ${opRef}`
        : `${events.length} status event${events.length === 1 ? "" : "s"}`
      }
      className="border-0 bg-transparent"
      bodyClassName="px-0 pb-0 pt-0"
      defaultOpen={defaultOpen}
    >
      <div className="space-y-3">
        {events.map((event, index) => (
          <div
            key={event.id}
            className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3"
          >
            <div className="relative flex justify-center">
              <span
                className={cn(
                  "mt-1.5 size-2.5 rounded-full ring-2 ring-background",
                  event.kind === "current" ? "bg-primary" : "bg-muted-foreground/70",
                  event.highlight && event.kind !== "current" && "bg-primary",
                )}
                aria-hidden
              />
              {index < events.length - 1 ?
                <span
                  className="absolute top-4 bottom-[-0.75rem] w-px bg-border/80"
                  aria-hidden
                />
              : null}
            </div>
            <div
              className={cn(
                "rounded-xl border p-3.5 sm:p-4",
                event.highlight ?
                  "border-primary/20 bg-primary/[0.04]"
                : cn("border-border/80", dashItemsTimelineCard),
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {event.label}
                  </p>
                  <p className="font-semibold leading-snug text-foreground">
                    {event.headline}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {event.detail}
                  </p>
                </div>
                <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                  <time
                    dateTime={event.at}
                    className="text-xs tabular-nums text-muted-foreground"
                  >
                    {new Date(event.at).toLocaleString()}
                  </time>
                  <ProductHistoryEventPreviewDialog
                    eventLabel={event.label}
                    eventHeadline={event.headline}
                    modalTitle={event.modalTitle}
                    preview={eventPreview(
                      event,
                      request,
                      statusLabel,
                      quotes,
                      batchShare,
                      batchEstimateNote,
                      event.snapshot?.phase === "warehouse_delivery_received" ?
                        orderContext?.orderItem.warehouseReceivedProofPhotoUrls ?? null
                      : null,
                      receivedProductPhotos,
                      snapshots,
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToggleSection>
  );
}
