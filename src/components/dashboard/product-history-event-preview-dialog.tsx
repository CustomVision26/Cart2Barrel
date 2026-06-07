"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ItemRequestLineSnapshotPreviewPanel,
  type ReceivedProductPhoto,
} from "@/components/orders/item-request-line-snapshot-preview-panel";
import type { ItemQuote, ItemRequest, ItemRequestLineSnapshot } from "@/db/schema";
import type { BatchLineShare } from "@/lib/batch-line-share";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";

export type ProductHistoryTimelinePreview =
  | {
      kind: "snapshot";
      snapshot: ItemRequestLineSnapshot;
      prevSnapshot: ItemRequestLineSnapshot | null;
      warehouseProofPhotoUrls?: string[] | null;
      receivedProductPhotos?: ReceivedProductPhoto[] | null;
      receiptPhotoUrl?: string | null;
      productImageUrl?: string | null;
      /** Staff note from the linked estimate; shown in place of the customer note. */
      estimateNote?: string | null;
      /** Linked estimate total (cents); shown as an "Estimate total" block. */
      estimateTotalCents?: number | null;
      /** Linked quote row for single-product estimate breakdown. */
      estimateQuote?: ItemQuote | null;
      /** This product's batch estimate share; replaces the single estimate when batched. */
      batchShare?: BatchLineShare | null;
      /** Batch estimate note (staff); shown instead of the single estimate note when batched. */
      batchEstimateNote?: string | null;
      isBatchedProduct?: boolean;
      auditSnapshots?: readonly ItemRequestLineSnapshot[] | null;
      receivedConditionRaw?: string | null;
    }
  | { kind: "current"; request: ItemRequest; statusLabel: string };

function CurrentProductStatusPreviewPanel({
  request,
  statusLabel,
}: {
  request: ItemRequest;
  statusLabel: string;
}) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Latest business status for this product line (not a frozen snapshot row).
      </p>
      <dl className="grid gap-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current status
          </dt>
          <dd className="font-medium text-foreground">{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product
          </dt>
          <dd className="font-medium">{request.productName?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Site
          </dt>
          <dd>{displaySiteName(request.siteName, request.productUrl)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Qty
          </dt>
          <dd className="tabular-nums">{request.quantity}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ProductHistoryEventPreviewDialog({
  eventLabel,
  eventHeadline,
  modalTitle,
  preview,
  triggerLabel = "View record",
}: {
  eventLabel: string;
  eventHeadline: string;
  modalTitle?: string;
  preview: ProductHistoryTimelinePreview;
  triggerLabel?: string;
}) {
  const dialogTitle = modalTitle ?? eventLabel;
  const dialogDescription = eventHeadline;

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,56rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-1 border-b border-border/80 bg-muted/30 px-5 py-4 sm:px-6">
          <DialogTitle className="text-base font-semibold leading-snug sm:text-lg">
            {dialogTitle}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
          {preview.kind === "snapshot" ?
            <ItemRequestLineSnapshotPreviewPanel
              row={preview.snapshot}
              prevRow={preview.prevSnapshot}
              warehouseProofPhotoUrls={preview.warehouseProofPhotoUrls}
              receivedProductPhotos={preview.receivedProductPhotos}
              receiptPhotoUrl={preview.receiptPhotoUrl}
              productImageUrl={preview.productImageUrl}
              replaceNoteWithEstimate
              estimateNote={preview.estimateNote}
              estimateTotalCents={preview.estimateTotalCents}
              estimateQuote={preview.estimateQuote}
              batchShare={preview.batchShare}
              batchEstimateNote={preview.batchEstimateNote}
              isBatchedProduct={preview.isBatchedProduct}
              auditSnapshots={preview.auditSnapshots}
              receivedConditionRaw={preview.receivedConditionRaw}
              hideDuplicateChangeSummary
            />
          : <CurrentProductStatusPreviewPanel
              request={preview.request}
              statusLabel={preview.statusLabel}
            />
          }
        </div>
        <DialogFooter showCloseButton className="border-t border-border/80 px-5 py-3 sm:px-6" />
      </DialogContent>
    </Dialog>
  );
}
