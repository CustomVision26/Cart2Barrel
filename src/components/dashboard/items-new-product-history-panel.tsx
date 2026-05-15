"use client";

import { ChevronDown, InfoIcon, SearchIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import type { OwnerBatchQuoteSessionBundle } from "@/data/batch-quote-sessions";
import type {
  BatchQuoteEstimate,
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
} from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import { itemRequestStatusLabel } from "@/lib/item-request-status-label";
import { fulfillmentProductHistoryBadgeKindFromSnapshots } from "@/lib/product-history-fulfillment";
import {
  batchQuoteSessionEventKindLabel,
  ownerBatchQuoteSessionStatusBadge,
} from "@/lib/batch-quote-session-status-labels";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import { displaySiteName } from "@/lib/site-name";
import {
  batchQuoteSessionBadgeKind,
  itemRequestWorkflowBadgeKind,
} from "@/lib/status-badge-map";
import { cn } from "@/lib/utils";

import { useAddItemPayload } from "./add-item-payload-context";

function shortId(id: string): string {
  return `${id.slice(0, 8)}...`;
}

function latestActivityMs(
  request: ItemRequest,
  snapshots: ItemRequestLineSnapshot[],
  quotes: ItemQuote[],
): number {
  const times = [
    new Date(request.createdAt).getTime(),
    ...snapshots.map((s) => new Date(s.createdAt).getTime()),
    ...quotes.map((q) => new Date(q.createdAt).getTime()),
  ].filter(Number.isFinite);
  return Math.max(...times);
}

function searchMatches(
  request: ItemRequest,
  snapshots: ItemRequestLineSnapshot[],
  quotes: ItemQuote[],
  batchNumber: string | null,
  query: string,
): boolean {
  if (!query) return true;
  const haystack = [
    request.id,
    request.productName,
    request.productUrl,
    request.siteName,
    request.status,
    itemRequestStatusLabel(request.status),
    request.note,
    request.productSize,
    request.productColor,
    batchNumber,
    ...snapshots.flatMap((s) => [
      s.phase,
      itemRequestLineSnapshotPhaseLabel(s.phase),
      auditSnapshotStatusHeadline(s),
      s.auditMemo,
      s.createdAt,
      s.itemQuoteId,
      s.batchQuoteSessionId,
    ]),
    ...quotes.flatMap((q) => [
      q.id,
      q.createdAt,
      q.checkoutSnapshotKind,
      q.voidReason,
      formatUsd(q.itemCost),
      formatUsd(q.serviceFee),
      formatUsd(q.estimatedShipping),
      formatUsd(q.totalPrice),
    ]),
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

type ProductHistoryFilter =
  | "all"
  | "batch_checkout"
  | "single_product"
  | "with_quotes"
  | "with_timeline";

type ProductHistorySort =
  | "activity_desc"
  | "activity_asc"
  | "created_desc"
  | "name_asc"
  | "quote_total_desc";

function isBatchCheckoutBundle(bundle: OwnerBatchQuoteSessionBundle | undefined) {
  return (
    bundle != null &&
    (bundle.session.cartAcceptanceAcceptedAt != null ||
      bundle.session.status === "in_cart" ||
      bundle.session.status === "paid_pending_staff_purchase")
  );
}

function highestQuoteTotal(quotes: ItemQuote[]): number {
  return Math.max(0, ...quotes.map((quote) => quote.totalPrice ?? 0));
}

function productNameSortValue(request: ItemRequest): string {
  return (request.productName?.trim() || "Unnamed product").toLowerCase();
}

function ToggleBlock({
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 bg-muted/20 px-3 py-3 text-left hover:bg-muted/35"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-foreground">{title}</span>
          {summary ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </span>
      </button>
      {open ? <div className="space-y-3 p-3">{children}</div> : null}
    </section>
  );
}

function HelpBalloon({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group/help relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-primary focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <InfoIcon className="size-3" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-focus-within/help:block group-hover/help:block"
      >
        {children}
      </span>
    </span>
  );
}

function LabelWithHelp({
  htmlFor,
  children,
  help,
}: {
  htmlFor: string;
  children: ReactNode;
  help: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      <HelpBalloon label={`About ${children}`}>{help}</HelpBalloon>
    </span>
  );
}

function ChargesGrid({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-md border border-border bg-muted/10 p-2"
        >
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SingleEstimateRecord({ quote }: { quote: ItemQuote }) {
  const operational = isOperationalQuoteRow(quote);
  const label =
    quote.checkoutSnapshotKind === "paid" ?
      "Checkout price snapshot"
    : quote.checkoutSnapshotKind === "company_purchase" ?
      "Company purchase price snapshot"
    : quote.voidedAt ?
      "Superseded single estimate"
    : "Single estimate";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{label}</p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
            Quote {quote.id}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <time dateTime={quote.createdAt}>
            Created {new Date(quote.createdAt).toLocaleString()}
          </time>
          {quote.voidedAt ? (
            <>
              <br />
              Updated / voided{" "}
              <time dateTime={quote.voidedAt}>
                {new Date(quote.voidedAt).toLocaleString()}
              </time>
            </>
          ) : null}
        </p>
      </div>
      <ChargesGrid
        rows={[
          { label: "Item cost", value: formatUsd(quote.itemCost) },
          {
            label: "Merchandise savings",
            value:
              quote.merchandiseSavingsCents ?
                formatUsd(quote.merchandiseSavingsCents)
              : "-",
          },
          { label: "Service fee", value: formatUsd(quote.serviceFee) },
          { label: "Estimated shipping", value: formatUsd(quote.estimatedShipping) },
          { label: "Total price", value: formatUsd(quote.totalPrice) },
          { label: "Qty at estimate", value: quote.requestQuantity ?? "-" },
          { label: "Size at estimate", value: quote.requestProductSize?.trim() || "-" },
          { label: "Color at estimate", value: quote.requestProductColor?.trim() || "-" },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        {operational ?
          "Operational estimate row."
        : "Timeline snapshot row kept for checkout or purchase history."}
        {quote.merchandiseIncludesSiteShippingTax ?
          " Retailer shipping/tax was included in merchandise."
        : null}
        {quote.voidReason ? ` Void reason: ${quote.voidReason}.` : null}
      </p>
    </div>
  );
}

function BatchEstimateRecord({
  batchNumber,
  estimate,
}: {
  batchNumber: string;
  estimate: BatchQuoteEstimate;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">Batch estimate</p>
          <p className="mt-0.5 font-mono text-xs text-primary">{batchNumber}</p>
        </div>
        <time dateTime={estimate.createdAt} className="text-xs text-muted-foreground">
          Created {new Date(estimate.createdAt).toLocaleString()}
        </time>
      </div>
      <ChargesGrid
        rows={[
          { label: "Batch merchandise", value: formatUsd(estimate.batchMerchandiseTotalCents) },
          { label: "Site merchandise", value: formatUsd(estimate.siteMerchandiseTotalCents) },
          { label: "Item discount", value: formatUsd(estimate.itemDiscountCents) },
          { label: "Service & handling", value: formatUsd(estimate.serviceHandlingTotalCents) },
          { label: "Batch shipping", value: formatUsd(estimate.batchShippingTotalCents) },
          { label: "Site shipping", value: formatUsd(estimate.siteShippingTotalCents) },
          { label: "Shipping discount", value: formatUsd(estimate.shippingDiscountCents) },
          { label: "Batch sale tax", value: formatUsd(estimate.batchSaleTaxTotalCents) },
          { label: "Site sale tax", value: formatUsd(estimate.siteSaleTaxTotalCents) },
          { label: "Sale tax discount", value: formatUsd(estimate.saleTaxDiscountCents) },
          { label: "Subtotal", value: formatUsd(estimate.subtotalCents) },
        ]}
      />
    </div>
  );
}

function ProductTimeline({
  snapshots,
  quotesById,
}: {
  snapshots: ItemRequestLineSnapshot[];
  quotesById: Map<string, ItemQuote>;
}) {
  if (snapshots.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        No timeline snapshots were recorded for this product yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {snapshots.map((snap, index) => {
        const quote = snap.itemQuoteId ? quotesById.get(snap.itemQuoteId) : null;
        const previous = index > 0 ? snapshots[index - 1]! : null;

        return (
          <div key={snap.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
            <div className="relative flex justify-center">
              <span className="mt-1 size-2.5 rounded-full bg-primary" aria-hidden />
              {index < snapshots.length - 1 ? (
                <span
                  className="absolute top-4 bottom-[-0.75rem] w-px bg-border"
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="rounded-lg border border-border bg-muted/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {itemRequestLineSnapshotPhaseLabel(snap.phase)}
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {auditSnapshotStatusHeadline(snap)}
                  </p>
                </div>
                <time
                  dateTime={snap.createdAt}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {new Date(snap.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {auditSnapshotChangeSummary(snap, previous)}
              </p>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <p>
                  <span className="text-muted-foreground">Product id:</span>{" "}
                  <span className="font-mono">{shortId(snap.itemRequestId)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Product:</span>{" "}
                  {snap.productName?.trim() || "Unnamed product"}
                </p>
                <p>
                  <span className="text-muted-foreground">Qty:</span> {snap.quantity}
                </p>
                <p>
                  <span className="text-muted-foreground">Quote:</span>{" "}
                  <span className="font-mono">
                    {snap.itemQuoteId ? shortId(snap.itemQuoteId) : "-"}
                  </span>
                </p>
              </div>
              {quote ? (
                <div className="mt-3">
                  <SingleEstimateRecord quote={quote} />
                </div>
              ) : null}
              {snap.batchQuoteSessionId ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Batch session{" "}
                  <span className="font-mono text-primary">
                    {snap.batchQuoteSessionId}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductDetailDialog({
  triggerLabel,
  triggerSummary,
  title,
  description,
  help,
  children,
}: {
  triggerLabel: string;
  triggerSummary: string;
  title: string;
  description: string;
  help: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex w-full items-start gap-1.5 sm:w-auto">
      <Dialog>
        <DialogTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-auto min-h-10 w-full flex-col items-start gap-0.5 px-3 py-2 text-left sm:w-auto",
          )}
        >
          <span>{triggerLabel}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {triggerSummary}
          </span>
        </DialogTrigger>
        <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,56rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">{children}</div>
        </DialogContent>
      </Dialog>
      <span className="pt-2">
        <HelpBalloon label={`About ${triggerLabel}`}>{help}</HelpBalloon>
      </span>
    </span>
  );
}

function ProductHistoryCard({
  request,
  snapshots,
  quotes,
  bundle,
  statusLabel,
}: {
  request: ItemRequest;
  snapshots: ItemRequestLineSnapshot[];
  quotes: ItemQuote[];
  bundle?: OwnerBatchQuoteSessionBundle;
  statusLabel: string;
}) {
  const quotesById = new Map(quotes.map((quote) => [quote.id, quote]));
  const latestEstimate = bundle?.latestEstimate ?? null;
  const badgeKind =
    fulfillmentProductHistoryBadgeKindFromSnapshots(snapshots) ??
    itemRequestWorkflowBadgeKind(request.status);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <div className="grid gap-4 border-b border-border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="flex min-w-0 gap-4">
          <ProductRequestThumbnail
            variant="cart"
            imageUrl={request.productImageUrl}
            productLabel={request.productName}
            className="w-20 max-w-20 sm:w-24 sm:max-w-24"
          />
          <div className="min-w-0 space-y-2">
            <h2 className="line-clamp-2 text-base font-semibold text-foreground">
              {request.productName?.trim() || "Unnamed product"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {displaySiteName(request.siteName, request.productUrl)}
              {bundle ? ` - Batch ${bundle.session.batchNumber}` : " - Single product"}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-background px-2 py-1">
                Product id <span className="font-mono">{request.id}</span>
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-1">
                Qty {request.quantity}
              </span>
              {request.productSize?.trim() ? (
                <span className="rounded-md border border-border bg-background px-2 py-1">
                  Size {request.productSize.trim()}
                </span>
              ) : null}
              {request.productColor?.trim() ? (
                <span className="rounded-md border border-border bg-background px-2 py-1">
                  Color {request.productColor.trim()}
                </span>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-1.5">
              <a
                href={request.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open product page
              </a>
              <HelpBalloon label="About product page link">
                Opens the original shopper product URL in a new tab so staff can
                verify product details, availability, and retailer information.
              </HelpBalloon>
            </span>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-background p-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current record status
              <HelpBalloon label="About current record status">
                The latest business state for this product. Use the status filter
                above to isolate products in the same operational stage.
              </HelpBalloon>
            </p>
            <StatusBadge kind={badgeKind} className="mt-1" title={request.status}>
              {statusLabel}
            </StatusBadge>
          </div>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Created</dt>
              <dd className="tabular-nums text-foreground">
                <time dateTime={request.createdAt}>
                  {new Date(request.createdAt).toLocaleString()}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last recorded update</dt>
              <dd className="tabular-nums text-foreground">
                {new Date(latestActivityMs(request, snapshots, quotes)).toLocaleString()}
              </dd>
            </div>
            {bundle ? (
              <div>
                <dt className="text-xs text-muted-foreground">Batch status</dt>
                <dd>
                  <StatusBadge kind={batchQuoteSessionBadgeKind(bundle.session.status)}>
                    {ownerBatchQuoteSessionStatusBadge(bundle.session.status)}
                  </StatusBadge>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-4">
        <ProductDetailDialog
          triggerLabel="Open status timeline"
          triggerSummary={`${snapshots.length} saved product record${snapshots.length === 1 ? "" : "s"}`}
          title="Recorded Status Timeline"
          description="Every saved status and fulfillment snapshot for this product."
          help="Shows each saved product status change in order, including fulfillment snapshots, quote links, batch session IDs, and the timestamp for each record."
        >
          <ProductTimeline snapshots={snapshots} quotesById={quotesById} />
        </ProductDetailDialog>

        <ProductDetailDialog
          triggerLabel="Open single estimates"
          triggerSummary={`${quotes.length} quote / price snapshot row${quotes.length === 1 ? "" : "s"}`}
          title="Single Estimate Records"
          description="Single-product quote rows and checkout or purchase price snapshots."
          help="Opens the single-product estimate records with item cost, service fee, shipping, total price, quantity, size, color, and update details."
        >
          {quotes.length > 0 ? (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <SingleEstimateRecord key={quote.id} quote={quote} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              No single estimate rows are recorded for this product yet.
            </p>
          )}
        </ProductDetailDialog>

        {bundle ? (
          <ProductDetailDialog
            triggerLabel="Open batch experience"
            triggerSummary={`Batch ${bundle.session.batchNumber} - ${ownerBatchQuoteSessionStatusBadge(bundle.session.status)}`}
            title="Batch Estimate And Cart Experience"
            description="Batch estimate totals, cart acceptance, and batch status records."
            help="Opens the batch estimate and cart journey, including batch totals, accepted cart time, saved estimate values, and batch lifecycle records."
          >
            <ChargesGrid
              rows={[
                { label: "Batch number", value: bundle.session.batchNumber },
                { label: "Batch status", value: ownerBatchQuoteSessionStatusBadge(bundle.session.status) },
                { label: "Created", value: new Date(bundle.session.createdAt).toLocaleString() },
                {
                  label: "Submitted",
                  value: bundle.session.submittedAt ?
                    new Date(bundle.session.submittedAt).toLocaleString()
                  : "-",
                },
                {
                  label: "Accepted into cart",
                  value: bundle.session.cartAcceptanceAcceptedAt ?
                    new Date(bundle.session.cartAcceptanceAcceptedAt).toLocaleString()
                  : "-",
                },
              ]}
            />
            {latestEstimate ? (
              <BatchEstimateRecord
                batchNumber={bundle.session.batchNumber}
                estimate={latestEstimate}
              />
            ) : (
              <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                No batch estimate has been saved for this batch yet.
              </p>
            )}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Batch status records
              </p>
              {bundle.statusEvents.length > 0 ? (
                <div className="space-y-2">
                  {bundle.statusEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-md border border-border bg-muted/10 p-2 text-sm"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {batchQuoteSessionEventKindLabel(event.kind)}
                        </span>
                        <time
                          dateTime={event.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {new Date(event.createdAt).toLocaleString()}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No batch status event rows are recorded yet.
                </p>
              )}
            </div>
          </ProductDetailDialog>
        ) : null}
      </div>
    </article>
  );
}

function ProductHistoryPagination({
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalResults,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}) {
  if (totalResults === 0) return null;
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  const visiblePages = Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index,
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm text-card-foreground sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">
          {pageStart}-{pageEnd}
        </span>{" "}
        of <span className="font-medium text-foreground">{totalResults}</span>{" "}
        products
        <HelpBalloon label="About pagination">
          Use pagination to review large product histories in smaller groups while
          keeping the active search, filter, status, and sort settings.
        </HelpBalloon>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
        >
          First
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          Prev
        </button>
        {visiblePages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={cn(
              buttonVariants({
                variant: pageNumber === currentPage ? "default" : "outline",
                size: "sm",
              }),
              "min-w-8",
            )}
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === currentPage ? "page" : undefined}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
        >
          Last
        </button>
      </div>
    </div>
  );
}

export function ItemsNewProductHistoryPanel() {
  const {
    customer,
    activeRequests,
    historyRequests,
    batchBundles,
    snapshotsByRequestId,
    quotesByRequestId,
    fulfillmentLabelByRequestId,
  } = useAddItemPayload();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductHistoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<ProductHistorySort>("activity_desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const normalizedQuery = search.trim().toLowerCase();

  const allRequests = useMemo(() => {
    const map = new Map<string, ItemRequest>();
    for (const request of [...activeRequests, ...historyRequests]) {
      map.set(request.id, request);
    }
    for (const bundle of batchBundles) {
      for (const request of bundle.requests) {
        map.set(request.id, request);
      }
    }
    return [...map.values()];
  }, [activeRequests, historyRequests, batchBundles]);

  const batchBundleByRequestId = useMemo(() => {
    const map = new Map<string, (typeof batchBundles)[number]>();
    for (const bundle of batchBundles) {
      for (const request of bundle.requests) {
        map.set(request.id, bundle);
      }
    }
    return map;
  }, [batchBundles]);

  const productStats = useMemo(() => {
    let batchCheckoutCount = 0;
    let quotedCount = 0;
    let timelineCount = 0;

    for (const request of allRequests) {
      if (isBatchCheckoutBundle(batchBundleByRequestId.get(request.id))) {
        batchCheckoutCount += 1;
      }
      if ((quotesByRequestId[request.id] ?? []).length > 0) {
        quotedCount += 1;
      }
      if ((snapshotsByRequestId[request.id] ?? []).length > 0) {
        timelineCount += 1;
      }
    }

    return {
      batchCheckoutCount,
      quotedCount,
      singleProductCount: allRequests.length - batchCheckoutCount,
      timelineCount,
    };
  }, [allRequests, batchBundleByRequestId, quotesByRequestId, snapshotsByRequestId]);

  const statusOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const request of allRequests) {
      labels.add(
        fulfillmentLabelByRequestId[request.id] ??
          itemRequestStatusLabel(request.status),
      );
    }
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [allRequests, fulfillmentLabelByRequestId]);

  const filteredSorted = useMemo(() => {
    const rows = allRequests.filter((request) => {
      const bundle = batchBundleByRequestId.get(request.id);
      const snapshots = snapshotsByRequestId[request.id] ?? [];
      const quotes = quotesByRequestId[request.id] ?? [];
      const matchesSearch = searchMatches(
        request,
        snapshots,
        quotes,
        bundle?.session.batchNumber ?? null,
        normalizedQuery,
      );
      if (!matchesSearch) return false;
      const statusLabel =
        fulfillmentLabelByRequestId[request.id] ??
        itemRequestStatusLabel(request.status);
      if (statusFilter !== "all" && statusLabel !== statusFilter) return false;

      switch (filter) {
        case "batch_checkout":
          return isBatchCheckoutBundle(bundle);
        case "single_product":
          return !isBatchCheckoutBundle(bundle);
        case "with_quotes":
          return quotes.length > 0;
        case "with_timeline":
          return snapshots.length > 0;
        case "all":
          return true;
      }
    });
    rows.sort((a, b) => {
      const aMs = latestActivityMs(
        a,
        snapshotsByRequestId[a.id] ?? [],
        quotesByRequestId[a.id] ?? [],
      );
      const bMs = latestActivityMs(
        b,
        snapshotsByRequestId[b.id] ?? [],
        quotesByRequestId[b.id] ?? [],
      );

      switch (sort) {
        case "activity_asc":
          return aMs - bMs;
        case "created_desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "name_asc":
          return productNameSortValue(a).localeCompare(productNameSortValue(b));
        case "quote_total_desc":
          return (
            highestQuoteTotal(quotesByRequestId[b.id] ?? []) -
            highestQuoteTotal(quotesByRequestId[a.id] ?? [])
          );
        case "activity_desc":
          return bMs - aMs;
      }
    });
    return rows;
  }, [
    allRequests,
    batchBundleByRequestId,
    filter,
    fulfillmentLabelByRequestId,
    normalizedQuery,
    quotesByRequestId,
    sort,
    statusFilter,
    snapshotsByRequestId,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredSorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredSorted.length);
  const paginatedRequests = useMemo(
    () => filteredSorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredSorted, pageSize],
  );

  const groupedProducts = useMemo(() => {
    const groups: {
      key: string;
      title: ReactNode;
      summary: string;
      requests: ItemRequest[];
      defaultOpen?: boolean;
    }[] = [];
    const batchGroups = new Map<string, (typeof groups)[number]>();
    const singleRequests: ItemRequest[] = [];

    for (const request of paginatedRequests) {
      const bundle = batchBundleByRequestId.get(request.id);
      const wasBatchCheckout = isBatchCheckoutBundle(bundle);

      if (!bundle || !wasBatchCheckout) {
        singleRequests.push(request);
        continue;
      }

      const key = bundle.session.id;
      let group = batchGroups.get(key);
      if (!group) {
        group = {
          key,
          title: (
            <span className="flex flex-wrap items-center gap-2">
              <span>Batch estimate</span>
              <span className="font-mono text-primary">
                {bundle.session.batchNumber}
              </span>
              <StatusBadge kind={batchQuoteSessionBadgeKind(bundle.session.status)}>
                {ownerBatchQuoteSessionStatusBadge(bundle.session.status)}
              </StatusBadge>
            </span>
          ),
          summary: "0 products",
          requests: [],
        };
        batchGroups.set(key, group);
        groups.push(group);
      }
      group.requests.push(request);
      group.summary = `${group.requests.length} product${
        group.requests.length === 1 ? "" : "s"
      } checked out in this batch estimate`;
    }

    if (singleRequests.length > 0) {
      groups.push({
        key: "single-products",
        title: "Single products",
        summary: `${singleRequests.length} product${
          singleRequests.length === 1 ? "" : "s"
        } not checked out through a batch estimate`,
        requests: singleRequests,
      });
    }

    return groups;
  }, [batchBundleByRequestId, paginatedRequests]);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Product history control center{" "}
                <HelpBalloon label="About product history control center">
                  A dashboard for ecommerce operations to audit product requests,
                  estimates, batch checkouts, cart activity, purchase records, and
                  fulfillment status from one place.
                </HelpBalloon>
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                Find products, quotes, and batch activity fast
              </h2>
              <p className="text-sm text-muted-foreground">
                Search product timelines from request creation through quote, cart,
                checkout, purchase, and fulfillment records.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  Products
                  <HelpBalloon label="About products total">
                    Total unique products available in this customer history,
                    including active requests, history rows, and batch lines.
                  </HelpBalloon>
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {allRequests.length}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  Batch checkout
                  <HelpBalloon label="About batch checkout total">
                    Products that entered cart checkout from a batch estimate,
                    grouped by batch number below.
                  </HelpBalloon>
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {productStats.batchCheckoutCount}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  Quoted
                  <HelpBalloon label="About quoted total">
                    Products with at least one saved single estimate or checkout
                    price snapshot.
                  </HelpBalloon>
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {productStats.quotedCount}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  Timeline rows
                  <HelpBalloon label="About timeline rows total">
                    Products that have saved audit snapshots showing status,
                    quote, batch, checkout, or fulfillment changes.
                  </HelpBalloon>
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {productStats.timelineCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1.5fr)_repeat(5,minmax(9rem,1fr))_auto] xl:items-end">
          <div className="space-y-1.5">
            <LabelWithHelp
              htmlFor="dash-product-history-search"
              help="Search across product name, product ID, product URL, site, batch number, status, quote IDs, amounts, and timeline dates."
            >
              Search
            </LabelWithHelp>
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="dash-product-history-search"
                type="search"
                placeholder="Product, site, URL, quote, batch, status, date..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              htmlFor="dash-product-history-filter"
              help="Use this to narrow the control center to batch checkouts, single products, products with estimates, or products with saved timeline records."
            >
              Filter
            </LabelWithHelp>
            <select
              id="dash-product-history-filter"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as ProductHistoryFilter);
                setPage(1);
              }}
              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All products</option>
              <option value="batch_checkout">Checked out in batch</option>
              <option value="single_product">Single products</option>
              <option value="with_quotes">Has estimates</option>
              <option value="with_timeline">Has timeline records</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              htmlFor="dash-product-history-status"
              help="Filter by the product's current business status, such as paid, company purchase, delivery, or quote-related states."
            >
              Status
            </LabelWithHelp>
            <select
              id="dash-product-history-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              htmlFor="dash-product-history-sort"
              help="Choose whether users see newest activity first, oldest activity first, newest created products, alphabetical product names, or highest quote totals."
            >
              Sort
            </LabelWithHelp>
            <select
              id="dash-product-history-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ProductHistorySort);
                setPage(1);
              }}
              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="activity_desc">Newest activity</option>
              <option value="activity_asc">Oldest activity</option>
              <option value="created_desc">Newest created</option>
              <option value="name_asc">Product name A-Z</option>
              <option value="quote_total_desc">Highest quote total</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              htmlFor="dash-product-history-page-size"
              help="Controls how many product cards appear on each page. Smaller pages are easier to scan; larger pages are faster for bulk review."
            >
              Page size
            </LabelWithHelp>
            <select
              id="dash-product-history-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>

          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Results
              <HelpBalloon label="About result count">
                This count updates after search, filter, status, and sort controls are
                applied. Pagination uses this matching result set.
              </HelpBalloon>
            </p>
            <p className="font-medium text-foreground">
              {filteredSorted.length} match{filteredSorted.length === 1 ? "" : "es"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
              onClick={() => {
                setSearch("");
                setFilter("all");
                setStatusFilter("all");
                setSort("activity_desc");
                setPageSize(10);
                setPage(1);
              }}
              disabled={
                !search &&
                filter === "all" &&
                statusFilter === "all" &&
                sort === "activity_desc" &&
                pageSize === 10
              }
            >
              Reset filters
            </button>
            <HelpBalloon label="About reset filters">
              Clears the search box, resets all filters, returns to newest activity
              sort, and puts the page size back to the default.
            </HelpBalloon>
          </div>
        </div>
      </section>

      {allRequests.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No product history yet. Requests, quotes, and cart records will appear here.
        </p>
      ) : null}

      {allRequests.length > 0 && filteredSorted.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No product history records match your search.
        </p>
      ) : null}

      {filteredSorted.length > 0 && totalPages > 1 ? (
        <ProductHistoryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageStart={pageStart}
          pageEnd={pageEnd}
          totalResults={filteredSorted.length}
          onPageChange={setPage}
        />
      ) : null}

      {filteredSorted.length > 0 ? (
        <ToggleBlock
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>Customer</span>
              <span className="text-primary">{customer.name}</span>
              {customer.email && customer.email !== customer.name ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {customer.email}
                </span>
              ) : null}
            </span>
          }
          summary={`Showing ${pageStart}-${pageEnd} of ${filteredSorted.length} matching product${
            filteredSorted.length === 1 ? "" : "s"
          }`}
        >
          <div className="space-y-4">
            {groupedProducts.map((group) => (
              <ToggleBlock
                key={group.key}
                title={group.title}
                summary={group.summary}
                defaultOpen={group.defaultOpen ?? true}
              >
                <div className="space-y-4">
                  {group.requests.map((request) => {
                    const snapshots = snapshotsByRequestId[request.id] ?? [];
                    const quotes = quotesByRequestId[request.id] ?? [];
                    const bundle = batchBundleByRequestId.get(request.id);
                    const statusLabel =
                      fulfillmentLabelByRequestId[request.id] ??
                      itemRequestStatusLabel(request.status);

                    return (
                      <ProductHistoryCard
                        key={request.id}
                        request={request}
                        snapshots={snapshots}
                        quotes={quotes}
                        bundle={bundle}
                        statusLabel={statusLabel}
                      />
                    );
                  })}
                </div>
              </ToggleBlock>
            ))}
          </div>
        </ToggleBlock>
      ) : null}

      {filteredSorted.length > 0 ? (
        <ProductHistoryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageStart={pageStart}
          pageEnd={pageEnd}
          totalResults={filteredSorted.length}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
