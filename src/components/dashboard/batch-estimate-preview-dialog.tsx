"use client";

import { EyeIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toast } from "sonner";

import { requestBatchEstimateRevisionAction } from "@/actions/customer-batch-quote";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { BatchQuoteEstimate, ItemQuote, ItemRequest } from "@/db/schema";
import { allocateCentsByWeight } from "@/lib/allocate-cents";
import { formatUsd } from "@/lib/admin-markup";
import {
  dashItemsTableStatusPanel,
  dashItemsTimelineCard,
} from "@/lib/app-table-surfaces";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";

type BatchLineEstimate = {
  productName: string | null;
  siteName: string | null;
  productUrl: string;
  quantity: number;
  size: string | null;
  color: string | null;
  merchandise: number;
  serviceFee: number;
  shipping: number;
  tax: number;
  total: number;
};

function latestQuoteForList(quotes: ItemQuote[]): ItemQuote | null {
  if (quotes.length === 0) return null;
  return (
    [...quotes].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0] ?? null
  );
}

/** Divide the saved batch estimate across bundled products, weighted by each line's latest quote. */
function buildBatchLineEstimates(
  estimate: BatchQuoteEstimate,
  requests: ItemRequest[],
  quotesByRequestId: Record<string, ItemQuote[]>,
): BatchLineEstimate[] {
  if (requests.length === 0) return [];
  const lineQuotes = requests.map((r) =>
    latestQuoteForList(quotesByRequestId[r.id] ?? []),
  );
  const merch = allocateCentsByWeight(
    estimate.siteMerchandiseTotalCents,
    lineQuotes.map((q) => q?.itemCost ?? 0),
  );
  const service = allocateCentsByWeight(
    estimate.serviceHandlingTotalCents,
    lineQuotes.map((q) => q?.serviceFee ?? 0),
  );
  const shipping = allocateCentsByWeight(
    estimate.siteShippingTotalCents,
    lineQuotes.map((q) => q?.estimatedShipping ?? 0),
  );
  const tax = allocateCentsByWeight(
    estimate.siteSaleTaxTotalCents,
    lineQuotes.map((q) => (q ? lineSaleTaxCentsFromQuote(q) : 0)),
  );
  return requests.map((r, i) => ({
    productName: r.productName,
    siteName: r.siteName,
    productUrl: r.productUrl,
    quantity: r.quantity,
    size: r.productSize?.trim() || null,
    color: r.productColor?.trim() || null,
    merchandise: merch[i] ?? 0,
    serviceFee: service[i] ?? 0,
    shipping: shipping[i] ?? 0,
    tax: tax[i] ?? 0,
    total:
      (merch[i] ?? 0) + (service[i] ?? 0) + (shipping[i] ?? 0) + (tax[i] ?? 0),
  }));
}

function BatchLineEstimateCard({ line }: { line: BatchLineEstimate }) {
  return (
    <li className="rounded-md border border-border bg-muted px-3 py-2.5">
      <p className="font-medium text-foreground">
        {line.productName?.trim() || "Product"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {displaySiteName(line.siteName, line.productUrl)}
      </p>
      <dl className="mt-2 grid gap-1 border-t border-border pt-2 text-xs tabular-nums">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Qty</dt>
          <dd className="text-foreground">{line.quantity}</dd>
        </div>
        {line.size ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="text-end text-foreground">{line.size}</dd>
          </div>
        ) : null}
        {line.color ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Color</dt>
            <dd className="text-end text-foreground">{line.color}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 rounded-md border border-border bg-card px-2.5 py-2.5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Batch estimate share (this product)
        </p>
        <ul className="space-y-1.5 text-xs tabular-nums text-muted-foreground">
          <li className="flex justify-between gap-2">
            <span>Merchandise total</span>
            <span className="text-foreground">{formatUsd(line.merchandise)}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Service &amp; handling</span>
            <span className="text-foreground">{formatUsd(line.serviceFee)}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Shipping (est.)</span>
            <span className="text-foreground">{formatUsd(line.shipping)}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Tax / sale tax</span>
            <span className="text-foreground">{formatUsd(line.tax)}</span>
          </li>
          <li className="flex justify-between gap-2 border-t border-border pt-2 font-medium text-foreground">
            <span>Total</span>
            <span>{formatUsd(line.total)}</span>
          </li>
        </ul>
      </div>
    </li>
  );
}

type BatchEstimatePreviewDialogProps = {
  batchSessionId: string;
  batchNumber: string;
  siteKey: string;
  estimate: BatchQuoteEstimate;
  requests?: ItemRequest[];
  quotesByRequestId?: Record<string, ItemQuote[]>;
};

export function BatchEstimatePreviewDialog({
  batchSessionId,
  batchNumber,
  siteKey,
  estimate,
  requests = [],
  quotesByRequestId = {},
}: BatchEstimatePreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmRevisionOpen, setConfirmRevisionOpen] = useState(false);
  const [revisionPending, revisionStart] = useTransition();

  const subtotalCalc =
    estimate.siteMerchandiseTotalCents +
    estimate.serviceHandlingTotalCents +
    estimate.siteSaleTaxTotalCents +
    estimate.siteShippingTotalCents;

  const lineEstimates = buildBatchLineEstimates(
    estimate,
    requests,
    quotesByRequestId,
  );

  const cancelRevisionConfirm = () => {
    setConfirmRevisionOpen(false);
  };

  const confirmRevision = () => {
    revisionStart(async () => {
      const res = await requestBatchEstimateRevisionAction({ batchSessionId });
      setConfirmRevisionOpen(false);
      if (!res.ok) {
        toast.error(res.message ?? "Could not submit request.");
        return;
      }
      toast.success(res.message ?? "Requested.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmRevisionOpen(false);
        }}
      >
        <DialogTrigger
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
          Preview estimate
        </DialogTrigger>
        <DialogContent className="max-h-[min(85vh,560px)] w-[min(96vw,26rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch estimate</DialogTitle>
            <DialogDescription>
              Batch{" "}
              <span className="font-mono font-medium text-foreground">{batchNumber}</span>
              {" · "}
              <span className="text-muted-foreground">{siteKey}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm tabular-nums">
            {lineEstimates.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Individual product estimates
                </p>
                <ul className="space-y-2 text-sm">
                  {lineEstimates.map((line) => (
                    <BatchLineEstimateCard key={line.productUrl} line={line} />
                  ))}
                </ul>
                <Separator />
              </div>
            ) : null}

            <ul className="space-y-2 text-muted-foreground">
              <li className="flex justify-between gap-2">
                <span>Site merchandise</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteMerchandiseTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Service &amp; handling</span>
                <span className="text-foreground">
                  {formatUsd(estimate.serviceHandlingTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Site shipping</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteShippingTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Site sale tax</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteSaleTaxTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2 border-t border-border pt-2 font-semibold text-foreground">
                <span>Customer subtotal</span>
                <span>{formatUsd(subtotalCalc)}</span>
              </li>
            </ul>

            <div className={cn("flex justify-between text-xs tabular-nums", dashItemsTimelineCard)}>
              <span className="text-muted-foreground">Saved subtotal (staff)</span>
              <span className="font-medium text-foreground">
                {formatUsd(estimate.subtotalCents)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Customer subtotal is site merchandise + service &amp; handling + site sale tax +
              site shipping. The saved subtotal is what staff recorded for this batch.
            </p>
            <p className="text-xs text-muted-foreground">
              Saved{" "}
              <time dateTime={estimate.createdAt}>
                {new Date(estimate.createdAt).toLocaleString()}
              </time>
              .
            </p>

            {estimate.staffNote?.trim() ? (
              <div className={cn(dashItemsTimelineCard)}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Batch estimate notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {estimate.staffNote.trim()}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:min-w-0 sm:flex-1"
                onClick={() => setConfirmRevisionOpen(true)}
              >
                Request estimate
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:min-w-0 sm:flex-1"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmRevisionOpen}
        onOpenChange={(next) => {
          if (!next && revisionPending) return;
          setConfirmRevisionOpen(next);
        }}
      >
        <DialogContent showCloseButton={false} className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a revised batch estimate?</DialogTitle>
            <DialogDescription className="text-pretty">
              This batch estimate will be set aside (kept on record) and returned to staff.
              Individual line quotes stay unchanged unless staff updates them—you are asking
              for a fresh batch bundled price when they save again. Withdrawn, rejected, or
              cart-accepted lines are removed from this bundle automatically so staff only see
              the remaining quoted storefront lines.
            </DialogDescription>
          </DialogHeader>
          <p className={cn(dashItemsTableStatusPanel, "font-mono text-xs text-muted-foreground")}>
            Batch <span className="text-foreground">{batchNumber}</span>
          </p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="sm:min-w-0"
              disabled={revisionPending}
              onClick={cancelRevisionConfirm}
            >
              Keep this estimate
            </Button>
            <Button type="button" className="sm:min-w-[11rem]" onClick={confirmRevision} disabled={revisionPending}>
              {revisionPending ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Yes, send request"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
