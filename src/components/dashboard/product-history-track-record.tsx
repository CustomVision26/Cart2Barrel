"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  ProductHistoryEventPreviewDialog,
  type ProductHistoryTimelinePreview,
} from "@/components/dashboard/product-history-event-preview-dialog";
import type {
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { outsidePurchaseReferenceLabel } from "@/lib/outside-purchase-lifecycle";
import {
  buildProductHistoryTimelineEvents,
  type ProductHistoryTimelineEvent,
} from "@/lib/product-history-timeline";
import { cn } from "@/lib/utils";

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
      <div className="flex flex-wrap items-center gap-3 bg-muted/25 px-3 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
): ProductHistoryTimelinePreview {
  if (event.kind === "snapshot" && event.snapshot) {
    return {
      kind: "snapshot",
      snapshot: event.snapshot,
      prevSnapshot: event.prevSnapshot ?? null,
    };
  }
  return { kind: "current", request, statusLabel };
}

export function ProductHistoryTrackRecord({
  request,
  snapshots,
  quotes,
  fulfillmentLabelOverride,
  returnRequest,
  statusLabel,
  defaultOpen = true,
}: {
  request: ItemRequest;
  snapshots: ItemRequestLineSnapshot[];
  quotes: ItemQuote[];
  fulfillmentLabelOverride?: string | null;
  returnRequest?: OutsidePurchaseReturnRequest | null;
  statusLabel: string;
  defaultOpen?: boolean;
}) {
  const quotesById = useMemo(
    () => new Map(quotes.map((quote) => [quote.id, quote])),
    [quotes],
  );
  const outsidePurchase = isOutsidePurchaseRequest(request);
  const events = useMemo(
    () =>
      buildProductHistoryTimelineEvents(request, snapshots, quotesById, {
        fulfillmentLabelOverride,
        returnRequest,
      }),
    [request, snapshots, quotesById, fulfillmentLabelOverride, returnRequest],
  );
  const opRef = outsidePurchase ? outsidePurchaseReferenceLabel(request) : null;

  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        No status records were saved for this product yet.
      </p>
    );
  }

  return (
    <ToggleSection
      ariaLabel="Toggle track record log for this product"
      title={
        <span className="text-sm font-semibold text-foreground">Track record log</span>
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
      <div className="space-y-4">
        {events.map((event, index) => (
          <div
            key={event.id}
            className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3"
          >
            <div className="relative flex justify-center">
              <span
                className={cn(
                  "mt-1 size-2.5 rounded-full",
                  event.kind === "current" ? "bg-primary" : "bg-muted-foreground",
                  event.highlight && event.kind !== "current" && "bg-primary",
                )}
                aria-hidden
              />
              {index < events.length - 1 ?
                <span
                  className="absolute top-4 bottom-[-1rem] w-px bg-border"
                  aria-hidden
                />
              : null}
            </div>
            <div
              className={cn(
                "rounded-lg border p-3",
                event.highlight ?
                  "border-primary/25 bg-primary/5"
                : "border-border bg-muted/10",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {event.label}
                  </p>
                  <p className="mt-1 font-medium leading-snug text-foreground">
                    {event.headline}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <time
                    dateTime={event.at}
                    className="text-xs tabular-nums text-muted-foreground"
                  >
                    {new Date(event.at).toLocaleString()}
                  </time>
                  <ProductHistoryEventPreviewDialog
                    eventLabel={event.label}
                    eventHeadline={event.headline}
                    preview={eventPreview(event, request, statusLabel)}
                  />
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {event.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ToggleSection>
  );
}
