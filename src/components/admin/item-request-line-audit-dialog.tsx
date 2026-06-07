"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { useEffect, useMemo, useState } from "react";

import { ItemRequestLineSnapshotPreviewPanel } from "@/components/orders/item-request-line-snapshot-preview-panel";
import { ReceivedPhotosViewer, type ReceivedProductPhoto } from "@/components/orders/received-photos-viewer";
import {
  BatchEstimateRecordDialogButton,
  SingleEstimateRecordsDialogButton,
} from "@/components/orders/product-estimate-record-buttons";
import { filterSingleEstimateDisplayQuotes } from "@/components/orders/single-estimate-records";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BatchQuoteEstimate, ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { isProductBatchCheckoutFromSnapshots, isProductBatchBundleFromSnapshots } from "@/lib/batch-checkout";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import type { BatchLineShare } from "@/lib/batch-line-share";
import {
  shouldHideSnapshotFromProductTracking,
  quoteForSnapshotPreview,
  shouldShowStaffEstimatePreviewForSnapshotPhase,
  snapshotPhaseDisplayLabel,
  filterDuplicateFrozenCopySnapshots,
} from "@/lib/snapshot-tracking-display";
import { auditSnapshotStatusHeadline, type AuditSnapshotStatusContext } from "@/lib/item-request-line-audit-status";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_AUDIT_LABEL } from "@/lib/outside-purchase-paid-status";
import { OUTSIDE_PURCHASE_RETURN_ESTIMATE_ACCEPTED_STATUS_LABEL } from "@/lib/outside-purchase-display";
import {
  linkOutsidePurchaseIntakePublishSnapshots,
  outsidePurchaseIntakeDraftStatusLabel,
  outsidePurchasePublishedStatusLabel,
} from "@/lib/outside-purchase-intake-audit-memo";
import { parseWarehouseReceiptMemo } from "@/lib/warehouse-receipt-snapshot-memo";
import { cn } from "@/lib/utils";

import { AdminProductUrlDialog } from "./admin-product-url-dialog";

function mergeReceivedProductPhotos(
  conditionPhotos: ReceivedProductPhoto[],
  productImageUrl?: string | null,
): ReceivedProductPhoto[] {
  const photos = conditionPhotos.filter((photo) => photo.url.trim());
  const productUrl = productImageUrl?.trim();
  if (productUrl && !photos.some((photo) => photo.url.trim() === productUrl)) {
    photos.push({ url: productUrl, label: "Product photo" });
  }
  return photos;
}

/**
 * Status label shown in the audit table/preview. Customer and staff-estimate
 * snapshots use the same queue vocabulary as the rest of the app
 * ("New request" / "Quoted"); everything else falls back to the headline.
 */
function auditStatusLabel(
  row: ItemRequestLineSnapshot,
  context?: AuditSnapshotStatusContext,
): string {
  switch (row.phase) {
    case "customer_submission":
      return "New request";
    case "post_admin_estimate_edit":
      return "Quoted";
    case "batch_request_submitted_to_staff":
      return "new request in batch";
    case "batch_estimate_admin_copy":
      return "quoted for batch";
    case "outside_purchase_intake":
      return outsidePurchaseIntakeDraftStatusLabel(row.auditMemo);
    case "outside_purchase_published":
      return outsidePurchasePublishedStatusLabel({
        row,
        snapshots: context?.snapshots,
        quoteStaffNote: context?.quoteStaffNote,
      });
    case "checkout_paid_pending_delivery":
      return "Checkout complete · awaiting company purchase";
    case "outside_purchase_return_estimate_accepted":
      return OUTSIDE_PURCHASE_RETURN_ESTIMATE_ACCEPTED_STATUS_LABEL;
    case "outside_purchase_checkout_paid":
      return PAID_OUTSIDE_PURCHASE_SERVICE_FEE_AUDIT_LABEL;
    default:
      return auditSnapshotStatusHeadline(row, context);
  }
}


type ItemRequestLineAuditDialogProps = {
  itemRequestId: string;
  productLabel: string;
  snapshots: ItemRequestLineSnapshot[];
  triggerLabel?: string;
  /** Outside-purchase lines hide size/color/qty/note and swap the URL for the received photo. */
  isOutsidePurchase?: boolean;
  /** Received condition photo(s) for outside purchases (slideshow when >1). */
  conditionPhotos?: ReceivedProductPhoto[];
  /** All quote/checkout price snapshots for this product (Estimate records button). */
  quotes?: ItemQuote[];
  /** Current/latest quote summarized by the "Estimate" charges button. */
  estimateQuote?: ItemQuote | null;
  /** This line's slice of its saved batch estimate (shown when batched). */
  batchEstimateShare?: BatchLineShare | null;
  /** Batch estimate note (staff); shown instead of the single estimate note when batched. */
  batchEstimateNote?: string | null;
  batchNumber?: string | null;
  batchEstimate?: BatchQuoteEstimate | null;
  /** Outside-purchase receipt photo URL for preview links. */
  receiptPhotoUrl?: string | null;
  /** Product image fallback for preview thumbnail. */
  productImageUrl?: string | null;
};

export function ItemRequestLineAuditDialog({
  itemRequestId,
  productLabel,
  snapshots,
  triggerLabel = "Audit trail",
  isOutsidePurchase = false,
  conditionPhotos = [],
  quotes = [],
  estimateQuote = null,
  batchEstimateShare = null,
  batchEstimateNote = null,
  batchNumber = null,
  batchEstimate = null,
  receiptPhotoUrl = null,
  productImageUrl = null,
}: ItemRequestLineAuditDialogProps) {
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Snapshots arrive oldest→newest; show them newest→oldest. The change summary
  // still compares against the chronologically previous (older) snapshot, which
  // is the next element in this reversed list.
  const isBatchedProduct =
    batchEstimateShare != null || isProductBatchBundleFromSnapshots(snapshots);
  const batchCheckout = isProductBatchCheckoutFromSnapshots(snapshots);
  const isBatchBundleProduct =
    batchEstimateShare != null && isProductBatchBundleFromSnapshots(snapshots);
  const displaySingleEstimateQuotes = useMemo(
    () => filterSingleEstimateDisplayQuotes(quotes),
    [quotes],
  );
  const showSingleEstimateButton = displaySingleEstimateQuotes.length > 0;
  const showBatchEstimateButton =
    isBatchBundleProduct && batchEstimateShare != null;
  const showEstimateToolbar = showSingleEstimateButton || showBatchEstimateButton;
  const displaySnapshots = useMemo(
    () =>
      filterDuplicateFrozenCopySnapshots(
        snapshots
          .filter(
            (row) =>
              row.phase !== "pre_admin_estimate_edit" &&
              !shouldHideSnapshotFromProductTracking(row.phase),
          )
          .filter((row) => {
            if (!row.itemQuoteId) return true;
            if (
              row.phase === "checkout_paid_pending_delivery" ||
              row.phase === "outside_purchase_checkout_paid"
            ) {
              return true;
            }
            const linked = quotes.find((quote) => quote.id === row.itemQuoteId);
            if (!linked) return true;
            return isOperationalQuoteRow(linked) && linked.voidedAt == null;
          }),
        snapshots,
      )
        .slice()
        .reverse(),
    [snapshots, quotes],
  );
  const previewRow =
    previewId === null
      ? null
      : (displaySnapshots.find((r) => r.id === previewId) ?? null);
  const previewIndex =
    previewRow ?
      displaySnapshots.findIndex((r) => r.id === previewRow.id)
    : -1;
  const previewPrev =
    previewRow && previewIndex >= 0 ?
      (displaySnapshots[previewIndex + 1] ?? null)
    : null;
  const previewQuote =
    previewRow ?
      quoteForSnapshotPreview(previewRow, quotes, estimateQuote)
    : null;
  const receivedProductPhotos = useMemo(
    () => mergeReceivedProductPhotos(conditionPhotos, productImageUrl),
    [conditionPhotos, productImageUrl],
  );
  const outsidePurchaseTreeLinks = useMemo(
    () =>
      isOutsidePurchase ?
        linkOutsidePurchaseIntakePublishSnapshots(snapshots)
      : new Map(),
    [isOutsidePurchase, snapshots],
  );

  useEffect(() => {
    if (!open) {
      setPreviewId(null);
      return;
    }
    if (displaySnapshots.length === 0) {
      setPreviewId(null);
      return;
    }
    setPreviewId((current) =>
      current && displaySnapshots.some((row) => row.id === current) ?
        current
      : displaySnapshots[0].id,
    );
  }, [open, displaySnapshots]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      {open ? (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setPreviewId(null);
          }}
        >
          <DialogContent className="max-h-[min(92vh,56rem)] w-[min(96vw,80rem)] max-w-[min(96vw,80rem)] gap-5 overflow-y-auto sm:max-w-[min(96vw,80rem)]">
            <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-semibold sm:text-2xl">
            Request line audit
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed sm:text-base">
            Frozen snapshots of what the customer submitted and what staff saved at
            each estimate step.
          </DialogDescription>
          <div className="space-y-3 text-sm text-muted-foreground sm:text-base">
            <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5">
              {productLabel.trim() ?
                <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                  {productLabel.trim()}
                </div>
              : null}
              <div
                className={cn(
                  "break-all font-mono text-xs text-muted-foreground",
                  productLabel.trim() && "mt-1",
                )}
              >
                {itemRequestId}
              </div>
            </div>
            <p className="text-xs leading-relaxed">
              Click or double-click a row to preview intake data and notes.
            </p>
          </div>
            </DialogHeader>
            {showEstimateToolbar ?
              <div className="flex flex-wrap gap-2">
                {showSingleEstimateButton ?
                  <SingleEstimateRecordsDialogButton
                    quotes={quotes}
                    batchCheckout={batchCheckout}
                  />
                : null}
                {showBatchEstimateButton ?
                  <BatchEstimateRecordDialogButton
                    batchNumber={batchNumber?.trim() || "Batch estimate"}
                    productName={productLabel}
                    batchShare={batchEstimateShare}
                    latestEstimate={batchEstimate}
                  />
                : null}
              </div>
            : null}
            {displaySnapshots.length === 0 ? (
              <p className="text-base text-muted-foreground">
                No audit rows yet. Older requests created before this feature only appear here
                after the next customer submission or staff estimate save.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_min(22rem,34%)] lg:items-start">
            <div className="min-w-0">
            <FloatingHorizontalScroll className="min-w-0" viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5">
              <table className="w-full min-w-[72rem] text-left text-sm sm:text-[0.9375rem]">
                <thead className="border-b border-border bg-muted">
                  <tr>
                    <th className="px-3 py-3 font-medium text-foreground">Phase</th>
                    <th className="px-3 py-3 font-medium text-foreground">Status</th>
                    <th className="px-3 py-3 font-medium text-foreground">Time</th>
                    <th className="px-3 py-3 font-medium text-foreground">Product</th>
                    <th className="px-3 py-3 font-medium text-foreground">
                      {isOutsidePurchase ? "Received photo" : "URL"}
                    </th>
                    {isOutsidePurchase ? null : (
                      <>
                        <th className="px-3 py-3 font-medium text-foreground">Size</th>
                        <th className="px-3 py-3 font-medium text-foreground">Color</th>
                        <th className="px-3 py-3 font-medium text-foreground">Qty</th>
                        <th className="px-3 py-3 font-medium text-foreground">Note</th>
                      </>
                    )}
                    <th className="px-3 py-3 font-medium text-foreground">Quote id</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displaySnapshots.map((row) => {
                    const wrMemo = parseWarehouseReceiptMemo(row.auditMemo);
                    const selected = previewId === row.id;
                    const treeLink = outsidePurchaseTreeLinks.get(row.id);
                    const isPublishedChild = treeLink?.role === "published-child";
                    const isIntakeParent =
                      treeLink?.role === "intake-parent" && treeLink.partnerId;
                    const rowQuote = quoteForSnapshotPreview(row, quotes, estimateQuote);
                    const rowStatusContext: AuditSnapshotStatusContext = {
                      snapshots,
                      quoteStaffNote: rowQuote?.staffNote ?? estimateQuote?.staffNote ?? null,
                    };
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "cursor-pointer align-top transition-colors hover:bg-muted",
                          selected &&
                            "bg-primary/10 ring-1 ring-inset ring-primary/25",
                          isPublishedChild && "bg-primary/[0.04]",
                          isIntakeParent && "bg-muted/15",
                        )}
                        title="Click or double-click to preview this record"
                        onClick={() => setPreviewId(row.id)}
                        onDoubleClick={() => setPreviewId(row.id)}
                      >
                        <td className="whitespace-nowrap px-3 py-3 text-foreground">
                          <div
                            className={cn(
                              "flex min-w-0 items-center gap-2",
                              isIntakeParent && "border-l-2 border-primary/30 pl-4",
                            )}
                          >
                            {isPublishedChild ?
                              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Child
                              </span>
                            : isIntakeParent ?
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Parent
                              </span>
                            : null}
                            <span className="min-w-0 leading-snug">
                              {snapshotPhaseDisplayLabel(row.phase, { isBatchedProduct })}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[22rem] px-3 py-3 align-top text-foreground">
                          <span className="line-clamp-2 font-medium leading-snug">
                            {auditStatusLabel(row, rowStatusContext)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          <time dateTime={row.createdAt}>
                            {new Date(row.createdAt).toLocaleString()}
                          </time>
                        </td>
                        <td className="max-w-[16rem] px-3 py-3 text-foreground">
                          <span className="line-clamp-3">
                            {row.productName?.trim() || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-block"
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            {isOutsidePurchase ?
                              conditionPhotos.length > 0 ?
                                <ReceivedPhotosViewer
                                  photos={conditionPhotos}
                                  triggerLabel="Received photo"
                                />
                              : <span className="text-muted-foreground">—</span>
                            : <AdminProductUrlDialog productUrl={row.productUrl} />}
                          </span>
                        </td>
                        {isOutsidePurchase ? null : (
                          <>
                            <td className="px-3 py-3 text-muted-foreground">
                              {row.productSize?.trim() || "—"}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {row.productColor?.trim() || "—"}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-foreground">
                              {wrMemo ?
                                `${wrMemo.receivedQty} / ${wrMemo.orderedQty}`
                              : row.quantity}
                            </td>
                            <td className="max-w-[18rem] px-3 py-3 text-muted-foreground">
                              <span className="line-clamp-4 whitespace-pre-wrap">
                                {row.note?.trim() || "—"}
                              </span>
                            </td>
                          </>
                        )}
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground sm:text-sm">
                          {row.itemQuoteId?.slice(0, 8) ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </FloatingHorizontalScroll>
            </div>
            <aside
              className={cn(
                "rounded-xl border border-border/80 bg-card p-3.5 shadow-sm ring-1 ring-foreground/5 sm:p-4",
                previewRow ?
                  "lg:sticky lg:top-0 lg:max-h-[min(92vh,56rem)] lg:overflow-y-auto"
                : "lg:min-h-[8rem]",
              )}
            >
              {previewRow ?
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Record preview
                  </p>
                  <ItemRequestLineSnapshotPreviewPanel
                    row={previewRow}
                    prevRow={previewPrev}
                    receivedProductPhotos={receivedProductPhotos}
                    receiptPhotoUrl={receiptPhotoUrl}
                    productImageUrl={productImageUrl}
                    replaceNoteWithEstimate={shouldShowStaffEstimatePreviewForSnapshotPhase(
                      previewRow.phase,
                    )}
                    estimateNote={previewQuote?.staffNote}
                    estimateTotalCents={previewQuote?.totalPrice}
                    estimateQuote={previewQuote}
                    batchShare={batchEstimateShare}
                    batchEstimateNote={batchEstimateNote}
                    isBatchedProduct={isBatchedProduct}
                    auditSnapshots={isOutsidePurchase ? snapshots : null}
                    showInternalIds
                  />
                </>
              : <p className="text-sm leading-relaxed text-muted-foreground">
                  Select a row in the table to preview the full record.
                </p>
              }
            </aside>
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
