"use client";

import { ExternalLinkIcon } from "lucide-react";

import { BatchLineShareBreakdown } from "@/components/orders/batch-line-share-breakdown";
import { SingleQuoteBreakdown } from "@/components/orders/single-quote-breakdown";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BarrelPipelineProductDetail } from "@/lib/barrel-pipeline-product-detail";
import { formatBarrelAssignmentWhenShort } from "@/lib/barrel-pipeline-product-display";
import { displaySiteName } from "@/lib/site-name";

const linkClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 sm:text-sm";

function VariantRow({
  label,
  requested,
  received,
  showRequested,
}: {
  label: string;
  requested: string | null;
  received: string | null;
  showRequested: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {showRequested ?
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Requested {label}
          </dt>
          <dd className="mt-0.5 text-sm text-foreground">{requested ?? "—"}</dd>
        </div>
      : null}
      <div className={showRequested ? undefined : "sm:col-span-2"}>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {showRequested ? `Received ${label}` : label}
        </dt>
        <dd className="mt-0.5 text-sm text-foreground">{received ?? "—"}</dd>
      </div>
    </div>
  );
}

export function BarrelPipelineProductDetailDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: BarrelPipelineProductDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const assignedShort = formatBarrelAssignmentWhenShort(detail?.assignedAt ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,40rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {detail ?
          <>
            <DialogHeader className="space-y-1 border-b border-border/80 bg-muted/30 px-5 py-4 sm:px-6">
              <DialogTitle className="text-base font-semibold leading-snug sm:text-lg">
                {detail.productName}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Product details for your barrel packing queue
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                <div className="flex gap-3.5 p-3.5 sm:gap-4 sm:p-4">
                  <ProductRequestThumbnail
                    variant="dialog"
                    imageUrl={detail.productImageUrl}
                    productLabel={detail.productName}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    {detail.isOutsidePurchase ?
                      <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                        Outside purchase
                        {detail.outsidePurchaseReference ?
                          ` · ${detail.outsidePurchaseReference}`
                        : null}
                      </span>
                    : <p className="text-xs text-muted-foreground">
                        {displaySiteName(detail.siteName, detail.productUrl)}
                      </p>
                    }
                    <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1.5 text-xs sm:text-sm">
                      <dt className="text-muted-foreground">Qty</dt>
                      <dd className="font-medium tabular-nums text-foreground">
                        {detail.quantity}
                      </dd>
                    </dl>
                  </div>
                </div>

                {!detail.isOutsidePurchase && detail.productUrl.trim() ?
                  <div className="border-t border-border/60 bg-muted/25 px-3.5 py-2.5 sm:px-4">
                    <a
                      href={detail.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClassName}
                    >
                      Open product page
                      <ExternalLinkIcon className="size-3 shrink-0 opacity-60" aria-hidden />
                    </a>
                  </div>
                : null}
              </div>

              <section className="space-y-3 rounded-xl border border-border/80 bg-card px-3.5 py-3.5 shadow-sm">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Variants
                </h3>
                <dl className="space-y-3">
                  <VariantRow
                    label="Size"
                    requested={detail.requestedSize}
                    received={detail.receivedSize}
                    showRequested={!detail.isOutsidePurchase}
                  />
                  <VariantRow
                    label="Color"
                    requested={detail.requestedColor}
                    received={detail.receivedColor}
                    showRequested={!detail.isOutsidePurchase}
                  />
                </dl>
              </section>

              <section className="space-y-2 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-3 shadow-sm">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status &amp; container
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Current status
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">
                      {detail.fulfillmentLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Container
                    </dt>
                    <dd className="mt-0.5 text-sm text-foreground">
                      {detail.assignedContainerAlias ?
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                            aria-hidden
                          />
                          <span className="font-medium">{detail.assignedContainerAlias}</span>
                          {assignedShort ?
                            <span className="text-muted-foreground">· {assignedShort}</span>
                          : null}
                        </span>
                      : <span className="text-muted-foreground">Awaiting assignment</span>}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {detail.isBatched ?
                    detail.batchNumber ?
                      `Batch ${detail.batchNumber} breakdown`
                    : "Batch breakdown"
                  : "Single purchase breakdown"}
                </h3>
                {detail.isBatched ?
                  <>
                    <BatchLineShareBreakdown share={detail.batchShare} />
                    {detail.batchEstimateNote ?
                      <div className="rounded-lg border border-border/80 bg-card px-3 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Batch estimate note
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {detail.batchEstimateNote}
                        </p>
                      </div>
                    : null}
                  </>
                : <SingleQuoteBreakdown
                    quote={detail.singleQuote}
                    title="Single product estimate"
                  />
                }
              </section>
            </div>

            <DialogFooter
              showCloseButton
              className="border-t border-border/80 px-5 py-3 sm:px-6"
            />
          </>
        : null}
      </DialogContent>
    </Dialog>
  );
}
