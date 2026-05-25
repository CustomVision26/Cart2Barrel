"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";

import { ProductHistoryTrackRecord } from "@/components/dashboard/product-history-track-record";
import { ReinstateProductButton } from "@/components/dashboard/reinstate-product-button";
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
import { StatusBadge } from "@/components/ui/status-badge";
import type { OwnerBatchQuoteSessionBundle } from "@/data/batch-quote-sessions";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type {
  BatchQuoteEstimate,
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { batchQuoteSessionEventKindLabel } from "@/lib/batch-quote-session-status-labels";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { resolveProductHistoryStatusDisplay } from "@/lib/product-history-status";
import { displaySiteName } from "@/lib/site-name";
import {
  dashItemsChargesCell,
  dashItemsTableRowExpanded,
  dashItemsTableRowHover,
  dashItemsTimelineCard,
} from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

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

function ChargesGrid({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.label}
          className={dashItemsChargesCell}
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
        </p>
      </div>
      <ChargesGrid
        rows={[
          { label: "Item cost", value: formatUsd(quote.itemCost) },
          { label: "Service fee", value: formatUsd(quote.serviceFee) },
          { label: "Estimated shipping", value: formatUsd(quote.estimatedShipping) },
          { label: "Total price", value: formatUsd(quote.totalPrice) },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        {operational ?
          "Operational estimate row."
        : "Timeline snapshot row kept for checkout or purchase history."}
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
          { label: "Subtotal", value: formatUsd(estimate.subtotalCents) },
        ]}
      />
    </div>
  );
}

export function ProductHistoryTableRow({
  request,
  snapshots,
  quotes,
  bundle,
  fulfillmentLabelOverride,
  returnRequest,
  orderContext,
}: {
  request: ItemRequest;
  snapshots: ItemRequestLineSnapshot[];
  quotes: ItemQuote[];
  bundle?: OwnerBatchQuoteSessionBundle;
  fulfillmentLabelOverride?: string | null;
  returnRequest?: OutsidePurchaseReturnRequest | null;
  orderContext?: ItemRequestOrderContext | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const outsidePurchase = isOutsidePurchaseRequest(request);
  const latestEstimate = bundle?.latestEstimate ?? null;
  const status = resolveProductHistoryStatusDisplay(request, snapshots, {
    returnRequest,
    fulfillmentLabelOverride,
    orderContext,
    audience: "customer",
  });
  const activityMs = latestActivityMs(request, snapshots, quotes);
  const productName = request.productName?.trim() || "Unnamed product";

  return (
    <Fragment>
      <tr className={cn("border-b border-border", dashItemsTableRowHover)}>
        <td className="w-10 px-2 py-3 align-top">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card text-foreground hover:bg-accent"
            aria-expanded={expanded}
            aria-label={
              expanded ?
                "Collapse status timeline for this product"
              : "Expand status timeline for this product"
            }
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                expanded ? "rotate-180" : "rotate-0",
              )}
            />
          </button>
        </td>
        <td className="min-w-[14rem] px-3 py-3 align-top">
          <div className="flex min-w-0 gap-3">
            <ProductRequestThumbnail
              variant="cart"
              imageUrl={request.productImageUrl}
              productLabel={productName}
              className="w-14 max-w-14 shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <p className="line-clamp-2 font-medium leading-snug text-foreground">
                {productName}
              </p>
              <p className="text-xs text-muted-foreground">
                {displaySiteName(request.siteName, request.productUrl)}
                {bundle ? ` · Batch ${bundle.session.batchNumber}` : ""}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {request.id}
              </p>
            </div>
          </div>
        </td>
        <td className="min-w-[10rem] px-3 py-3 align-top">
          <StatusBadge kind={status.badgeKind} title={status.title}>
            {status.label}
          </StatusBadge>
        </td>
        <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-sm text-foreground">
          {snapshots.length}
        </td>
        <td className="whitespace-nowrap px-3 py-3 align-top text-sm text-muted-foreground">
          <time dateTime={new Date(activityMs).toISOString()}>
            {new Date(activityMs).toLocaleString()}
          </time>
        </td>
        <td className="min-w-[10rem] px-3 py-3 align-top">
          <div className="flex flex-wrap gap-2">
            {request.status === "withdrawn" ?
              <ReinstateProductButton
                itemRequestId={request.id}
                productLabel={request.productName}
                isOutsidePurchase={outsidePurchase}
                paymentPrompted={Boolean(request.outsidePurchasePaymentPromptedAt)}
              />
            : null}
            {quotes.length > 0 ?
              <Dialog>
                <DialogTrigger
                  type="button"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Estimates ({quotes.length})
                </DialogTrigger>
                <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,56rem)] overflow-y-auto sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Single estimate records</DialogTitle>
                    <DialogDescription>
                      Quote and checkout price snapshots for this product.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {quotes.map((quote) => (
                      <SingleEstimateRecord key={quote.id} quote={quote} />
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            : null}
            {bundle ?
              <Dialog>
                <DialogTrigger
                  type="button"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Batch
                </DialogTrigger>
                <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,56rem)] overflow-y-auto sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Batch {bundle.session.batchNumber}</DialogTitle>
                    <DialogDescription>
                      Batch estimate and cart experience for this product.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <ChargesGrid
                      rows={[
                        {
                          label: "Created",
                          value: new Date(bundle.session.createdAt).toLocaleString(),
                        },
                      ]}
                    />
                    {latestEstimate ?
                      <BatchEstimateRecord
                        batchNumber={bundle.session.batchNumber}
                        estimate={latestEstimate}
                      />
                    : null}
                    {bundle.statusEvents.length > 0 ?
                      <div className="space-y-2">
                        {bundle.statusEvents.map((event) => (
                          <div
                            key={event.id}
                            className={cn(dashItemsTimelineCard, "text-sm")}
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <span className="font-medium">
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
                    : null}
                  </div>
                </DialogContent>
              </Dialog>
            : null}
          </div>
        </td>
      </tr>
      {expanded ?
        <tr className={dashItemsTableRowExpanded}>
          <td colSpan={6} className="px-4 py-4">
            <ProductHistoryTrackRecord
              request={request}
              snapshots={snapshots}
              quotes={quotes}
              fulfillmentLabelOverride={fulfillmentLabelOverride}
              returnRequest={returnRequest}
              orderContext={orderContext}
              statusLabel={status.label}
              defaultOpen
            />
          </td>
        </tr>
      : null}
    </Fragment>
  );
}
