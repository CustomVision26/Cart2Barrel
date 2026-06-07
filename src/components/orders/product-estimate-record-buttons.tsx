"use client";

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
import type {
  BatchQuoteEstimate,
  BatchQuoteSessionStatusEvent,
  ItemQuote,
  ItemRequest,
} from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import type { BatchLineShare } from "@/lib/batch-line-share";
import { batchQuoteSessionEventKindLabel } from "@/lib/batch-quote-session-status-labels";
import { dashItemsChargesCell, dashItemsTimelineCard } from "@/lib/app-table-surfaces";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";

import {
  filterSingleEstimateDisplayQuotes,
  SingleEstimateRecordsList,
} from "./single-estimate-records";

function ChargesGrid({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className={dashItemsChargesCell}>
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
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
          { label: "Merchandise", value: formatUsd(estimate.siteMerchandiseTotalCents) },
          {
            label: "Service & handling",
            value: formatUsd(estimate.serviceHandlingTotalCents),
          },
          { label: "Shipping", value: formatUsd(estimate.siteShippingTotalCents) },
          { label: "Tax / sale tax", value: formatUsd(estimate.siteSaleTaxTotalCents) },
        ]}
      />
      <div className="flex justify-between gap-2 border-t border-primary/20 pt-2 text-sm font-semibold tabular-nums text-foreground">
        <span>Subtotal</span>
        <span>{formatUsd(estimate.subtotalCents)}</span>
      </div>
      {estimate.staffNote?.trim() ? (
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Batch estimate notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {estimate.staffNote.trim()}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function BatchEstimateShareRecord({
  productName,
  share,
}: {
  productName: string;
  share: BatchLineShare;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Batch estimate share (this product)
      </p>
      <p className="text-sm font-medium leading-snug text-foreground">{productName}</p>
      <ul className="space-y-1.5 text-sm tabular-nums text-muted-foreground">
        <li className="flex justify-between gap-2">
          <span>Merchandise total</span>
          <span className="text-foreground">{formatUsd(share.merchandise)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Service &amp; handling</span>
          <span className="text-foreground">{formatUsd(share.serviceFee)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Shipping (est.)</span>
          <span className="text-foreground">{formatUsd(share.shipping)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Tax / sale tax</span>
          <span className="text-foreground">{formatUsd(share.tax)}</span>
        </li>
        <li className="flex justify-between gap-2 border-t border-border pt-2 font-semibold text-foreground">
          <span>Total</span>
          <span>{formatUsd(share.total)}</span>
        </li>
      </ul>
    </div>
  );
}

function ProductDetailRecord({ request }: { request: ItemRequest }) {
  const productName = request.productName?.trim() || "Unnamed product";
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex min-w-0 gap-3">
        <ProductRequestThumbnail
          variant="cart"
          imageUrl={request.productImageUrl}
          productLabel={productName}
          className="w-14 max-w-14 shrink-0"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium leading-snug text-foreground">{productName}</p>
          <p className="text-xs text-muted-foreground">
            {displaySiteName(request.siteName, request.productUrl)}
          </p>
        </div>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className={dashItemsChargesCell}>
          <dt className="text-xs text-muted-foreground">Qty</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {request.quantity}
          </dd>
        </div>
        <div className={dashItemsChargesCell}>
          <dt className="text-xs text-muted-foreground">Size</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {request.productSize?.trim() || "—"}
          </dd>
        </div>
        <div className={dashItemsChargesCell}>
          <dt className="text-xs text-muted-foreground">Color</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {request.productColor?.trim() || "—"}
          </dd>
        </div>
      </dl>
      {request.productUrl ? (
        <a
          href={request.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          View product url
        </a>
      ) : null}
    </div>
  );
}

type SingleEstimateRecordsDialogButtonProps = {
  quotes: ItemQuote[];
  batchCheckout?: boolean;
  className?: string;
};

export function SingleEstimateRecordsDialogButton({
  quotes,
  batchCheckout = false,
  className,
}: SingleEstimateRecordsDialogButtonProps) {
  const displayQuotes = filterSingleEstimateDisplayQuotes(quotes);
  if (displayQuotes.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
      >
        Single Estimate
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,56rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Single estimate records</DialogTitle>
          <DialogDescription>
            Single-product estimate breakdowns for this line.
          </DialogDescription>
        </DialogHeader>
        <SingleEstimateRecordsList
          quotes={displayQuotes}
          batchCheckout={batchCheckout}
        />
      </DialogContent>
    </Dialog>
  );
}

type BatchEstimateRecordDialogButtonProps = {
  batchNumber: string;
  request?: ItemRequest | null;
  productName?: string;
  batchShare?: BatchLineShare | null;
  latestEstimate?: BatchQuoteEstimate | null;
  statusEvents?: BatchQuoteSessionStatusEvent[];
  sessionCreatedAt?: string | null;
  className?: string;
};

export function BatchEstimateRecordDialogButton({
  batchNumber,
  request = null,
  productName,
  batchShare = null,
  latestEstimate = null,
  statusEvents = [],
  sessionCreatedAt = null,
  className,
}: BatchEstimateRecordDialogButtonProps) {
  const resolvedProductName =
    productName?.trim() || request?.productName?.trim() || "Unnamed product";

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
      >
        Batch Estimate
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,56rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Batch {batchNumber}</DialogTitle>
          <DialogDescription>
            Batch estimate and cart experience for this product.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {sessionCreatedAt ?
            <ChargesGrid
              rows={[
                {
                  label: "Created",
                  value: new Date(sessionCreatedAt).toLocaleString(),
                },
              ]}
            />
          : null}
          {request ? <ProductDetailRecord request={request} /> : null}
          {batchShare ?
            <BatchEstimateShareRecord
              productName={resolvedProductName}
              share={batchShare}
            />
          : null}
          {latestEstimate ?
            <BatchEstimateRecord batchNumber={batchNumber} estimate={latestEstimate} />
          : null}
          {statusEvents.length > 0 ?
            <div className="space-y-2">
              {[...statusEvents]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                )
                .map((event) => (
                  <div key={event.id} className={cn(dashItemsTimelineCard, "text-sm")}>
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
  );
}
