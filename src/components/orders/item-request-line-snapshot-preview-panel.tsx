"use client";

import type { ReactNode } from "react";
import { ExternalLinkIcon, ImageIcon } from "lucide-react";

import type { ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { SingleQuoteBreakdown } from "@/components/orders/single-quote-breakdown";
import { isOutsidePurchaseProductUrl } from "@/lib/outside-purchase";
import {
  ReceivedPhotosViewer,
  type ReceivedProductPhoto,
} from "@/components/orders/received-photos-viewer";

export type { ReceivedProductPhoto } from "@/components/orders/received-photos-viewer";
import { formatUsd } from "@/lib/admin-markup";
import type { BatchLineShare } from "@/lib/batch-line-share";
import {
  customerNoteWithoutReportedPrice,
  parseCustomerReportedRetailerPriceFromNote,
} from "@/lib/customer-reported-retailer-price-note";
import {
  shouldShowBatchEstimateShareForSnapshotPhase,
  shouldShowSingleQuoteBreakdownForSnapshotPhase,
  shouldShowStaffEstimatePreviewForSnapshotPhase,
  snapshotPhaseDisplayLabel,
} from "@/lib/snapshot-tracking-display";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
  type AuditSnapshotStatusContext,
} from "@/lib/item-request-line-audit-status";
import { isDuplicateFrozenCopySnapshotSummary } from "@/lib/audit-snapshot-duplicate-copy";
import { parseProductReturnTrackingMemo } from "@/lib/product-return-tracking-memo";
import { productReturnRequestNoteForSnapshot } from "@/lib/product-return-request-snapshot-note";
import {
  parseRefundRequestAuditMemo,
  refundRequestReasonKindLabel,
} from "@/lib/refund-request-audit-memo";
import {
  parseWarehouseReceiptMemo,
  warehouseReceiptIntakePhotoUrls,
} from "@/lib/warehouse-receipt-snapshot-memo";
import {
  warehouseMissingReasonLabel,
  warehouseReceiveConditionLabel,
} from "@/lib/warehouse-receive-condition";
import { SnapshotAuditMemoDisplay } from "@/components/orders/audit-memo-display";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { displaySiteName } from "@/lib/site-name";
import {
  parseOutsidePurchaseStaffNoteDisplay,
} from "@/lib/outside-purchase-staff-note-display";
import { cn } from "@/lib/utils";

const previewPhotoLinkClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 sm:text-sm";

function PreviewSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-xl border border-border/80 bg-card px-3.5 py-3.5 shadow-sm">
        {children}
      </div>
    </section>
  );
}

function StaffEstimateNotePanel({
  note,
  title,
  isOutsidePurchase,
}: {
  note: string;
  title: string;
  isOutsidePurchase: boolean;
}) {
  const trimmed = note.trim();
  if (!trimmed) {
    return (
      <PreviewSectionCard title={title}>
        <p className="text-sm italic text-muted-foreground">
          {isOutsidePurchase ?
            "No intake details were recorded for this outside purchase."
          : "No estimate note yet — staff has not completed an estimate for this product."}
        </p>
      </PreviewSectionCard>
    );
  }

  if (!isOutsidePurchase) {
    return (
      <PreviewSectionCard title={title}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {trimmed}
        </p>
      </PreviewSectionCard>
    );
  }

  const parsed = parseOutsidePurchaseStaffNoteDisplay(trimmed);
  const hasStructuredContent =
    parsed.policyNotice != null || parsed.fields.length > 0;

  if (!hasStructuredContent) {
    return (
      <PreviewSectionCard title={title}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {trimmed}
        </p>
      </PreviewSectionCard>
    );
  }

  return (
    <PreviewSectionCard title={title}>
      <div className="space-y-3">
        {parsed.policyNotice ?
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {parsed.policyNotice}
          </p>
        : null}
        {parsed.freeformParagraphs.map((paragraph, index) => (
          <p
            key={`freeform-${index}`}
            className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
          >
            {paragraph}
          </p>
        ))}
        {parsed.fields.length > 0 ?
          <dl className="grid gap-2.5 border-t border-border/60 pt-3 sm:grid-cols-2">
            {parsed.fields.map(({ label, value }, index) => (
              <div
                key={`${label}-${index}`}
                className={
                  label === "Service & handling" ||
                  label === "Return service & handling" ||
                  label === "Receipt note" ?
                    "sm:col-span-2"
                  : undefined
                }
              >
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm leading-snug text-foreground">
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        : null}
      </div>
    </PreviewSectionCard>
  );
}

function isWarehouseReceiptPhase(phase: ItemRequestLineSnapshot["phase"]): boolean {
  return (
    phase === "warehouse_delivery_received" ||
    phase === "warehouse_delivery_received_prior"
  );
}

function hasStructuredAuditMemo(row: ItemRequestLineSnapshot): boolean {
  if (row.phase === "customer_refund_request_submitted") {
    return parseRefundRequestAuditMemo(row.auditMemo) != null;
  }
  if (row.phase === "product_return_tracking_saved") {
    return parseProductReturnTrackingMemo(row.auditMemo) != null;
  }
  if (isWarehouseReceiptPhase(row.phase)) {
    return parseWarehouseReceiptMemo(row.auditMemo) != null;
  }
  return false;
}

function ProductReturnRequestNotesPanel({ note }: { note: string | null }) {
  return (
    <PreviewSectionCard title="Return request notes">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {note?.trim() || "No return request notes were recorded for this product."}
      </p>
    </PreviewSectionCard>
  );
}

function ProductReturnTrackingSnapshotPanel({
  row,
}: {
  row: ItemRequestLineSnapshot;
}) {
  const memo = parseProductReturnTrackingMemo(row.auditMemo);
  if (!memo) return null;
  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
        Return shipment tracking
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Tracking URL</dt>
          <dd className="mt-0.5 break-all font-mono text-xs">
            {memo.trackingUrl?.trim() ?
              <a
                href={memo.trackingUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {memo.trackingUrl.trim()}
              </a>
            : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Carrier / retailer</dt>
          <dd>{memo.retailerTrackingCompany?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Tracking number</dt>
          <dd className="font-mono text-xs">{memo.retailerTrackingNumber?.trim() || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

function formatWarehouseRecordedAt(iso: string | null | undefined): string {
  if (!iso?.trim()) return "Not available";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function WarehouseReceiptSnapshotPanel({
  row,
  warehouseProofPhotoUrls,
}: {
  row: ItemRequestLineSnapshot;
  warehouseProofPhotoUrls?: string[] | null;
}) {
  const wr = parseWarehouseReceiptMemo(row.auditMemo);
  if (!wr) return null;
  const intakePhotoUrls = warehouseReceiptIntakePhotoUrls(wr, warehouseProofPhotoUrls);
  const missingReportedAt = wr.recordedAt?.trim() || row.createdAt;
  const missingReasonLabel = warehouseMissingReasonLabel(wr.missingReason);
  const panelTitle =
    wr.intakeRole === "prior" ?
      "Prior warehouse intake (archived)"
    : wr.intakeContext === "replacement_after_return" ?
      "Replacement inbound receipt"
    : "Warehouse intake";
  return (
    <div
      className={
        wr.intakeRole === "prior" ?
          "rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
        : "rounded-lg border border-primary/25 bg-primary/5 p-4"
      }
    >
      <p
        className={
          wr.intakeRole === "prior" ?
            "text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200"
          : "text-xs font-semibold uppercase tracking-wide text-primary"
        }
      >
        {panelTitle}
        {wr.intakeSequence != null ?
          <span className="ml-1 font-normal normal-case text-muted-foreground">
            · intake #{wr.intakeSequence}
          </span>
        : null}
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Ordered qty</dt>
          <dd className="tabular-nums font-medium">{wr.orderedQty}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Received qty</dt>
          <dd className="tabular-nums font-medium">{wr.receivedQty}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Condition</dt>
          <dd>{warehouseReceiveConditionLabel(wr.condition)}</dd>
        </div>
        {wr.condition === "missing" ?
          <>
            {missingReasonLabel ?
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Missing detail
                </dt>
                <dd>{missingReasonLabel}</dd>
              </div>
            : null}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Missing reported
              </dt>
              <dd>
                <time dateTime={missingReportedAt}>
                  {formatWarehouseRecordedAt(missingReportedAt)}
                </time>
              </dd>
            </div>
          </>
        : null}
        {wr.conditionNotes?.trim() ?
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Condition notes</dt>
            <dd className="whitespace-pre-wrap">{wr.conditionNotes.trim()}</dd>
          </div>
        : null}
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Shelf / bin</dt>
          <dd>{wr.shelfLocation.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Proof photos</dt>
          <dd className="tabular-nums">
            {intakePhotoUrls.length > 0 ?
              intakePhotoUrls.length
            : wr.proofPhotoCount}
          </dd>
        </div>
        {wr.barcodeValue?.trim() ?
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Barcode / SKU</dt>
            <dd className="mt-0.5 font-mono text-xs">{wr.barcodeValue.trim()}</dd>
          </div>
        : null}
      </dl>
      {intakePhotoUrls.length > 0 ?
        <div className="mt-4 border-t border-primary/20 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Intake photos
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {intakePhotoUrls.map((url, index) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block max-w-full"
                title={`Open intake photo ${index + 1} in a new tab`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Warehouse intake proof ${index + 1}`}
                  className="max-h-72 max-w-full rounded-lg border border-border object-contain shadow-sm"
                />
              </a>
            ))}
          </div>
        </div>
      : wr.proofPhotoCount > 0 ?
        <p className="mt-3 text-xs text-muted-foreground">
          {wr.proofPhotoCount} proof photo{wr.proofPhotoCount === 1 ? "" : "s"} recorded;
          image preview is not available for this older receipt record.
        </p>
      : null}
    </div>
  );
}

function CustomerRefundRequestSnapshotPanel({
  row,
}: {
  row: ItemRequestLineSnapshot;
}) {
  const memo = parseRefundRequestAuditMemo(row.auditMemo);
  if (!memo) return null;
  const amountLabel =
    memo.requestedAmountCents == null ?
      "Full refundable remainder on line (requested)"
    : `${formatUsd(memo.requestedAmountCents)} (requested cap)`;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
        Refund submission
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Reason category</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {refundRequestReasonKindLabel(memo.reasonKind)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Amount preference</dt>
          <dd className="mt-0.5 text-foreground">{amountLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Explanation</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {memo.details.trim() || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ProductContextSection({
  row,
  receivedProductPhotos,
  receiptPhotoUrl,
  productImageUrl,
}: {
  row: ItemRequestLineSnapshot;
  /** Received product photos (condition + product) shown in the slideshow viewer. */
  receivedProductPhotos?: ReceivedProductPhoto[] | null;
  /** Receipt photo shown as its own link. */
  receiptPhotoUrl?: string | null;
  /** Fallback product image when the snapshot row has none (e.g. outside-purchase intake). */
  productImageUrl?: string | null;
}) {
  const wrMemo =
    isWarehouseReceiptPhase(row.phase) ?
      parseWarehouseReceiptMemo(row.auditMemo)
    : null;
  const qtyLabel =
    wrMemo ?
      `${wrMemo.receivedQty} received (ordered ${wrMemo.orderedQty})`
    : String(row.quantity);

  const productName = row.productName?.trim() || "—";
  const siteName = displaySiteName(row.siteName, row.productUrl);
  const size = row.productSize?.trim();
  const color = row.productColor?.trim();
  const reportedPrice = parseCustomerReportedRetailerPriceFromNote(row.note);
  const detailRows = [
    { label: "Qty", value: qtyLabel },
    ...(reportedPrice ?
      [
        { label: "Unit price", value: formatUsd(reportedPrice.unitPriceCents) },
        {
          label: "Merchandise subtotal",
          value: formatUsd(reportedPrice.merchandiseSubtotalCents),
        },
      ]
    : []),
    ...(size ? [{ label: "Size", value: size }] : []),
    ...(color ? [{ label: "Color", value: color }] : []),
  ];

  const isOutsidePurchase = isOutsidePurchaseProductUrl(row.productUrl ?? "");
  const effectiveProductImageUrl =
    row.productImageUrl?.trim() || productImageUrl?.trim() || null;
  const receivedPhotos = (receivedProductPhotos ?? []).filter((p) =>
    p.url.trim(),
  );
  const receiptUrl = receiptPhotoUrl?.trim() || null;
  const hasOutsidePurchaseLinks = receivedPhotos.length > 0 || Boolean(receiptUrl);

  const thumbnail = (
    <ProductRequestThumbnail
      variant="dialog"
      imageUrl={effectiveProductImageUrl}
      productLabel={productName}
    />
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex gap-3.5 p-3.5 sm:gap-4 sm:p-4">
        {effectiveProductImageUrl ?
          <a
            href={effectiveProductImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 transition-opacity hover:opacity-90"
            title="Open product photo"
          >
            {thumbnail}
          </a>
        : thumbnail}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="space-y-1.5">
            {isOutsidePurchase ?
              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Outside purchase
              </span>
            : null}
            <p className="text-sm font-semibold leading-snug text-foreground sm:text-base">
              {productName}
            </p>
            {!isOutsidePurchase ?
              <p className="text-xs text-muted-foreground">{siteName}</p>
            : null}
          </div>
          <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1.5 border-t border-border/60 pt-2.5 text-xs sm:text-sm">
            {detailRows.map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {isOutsidePurchase ?
        hasOutsidePurchaseLinks ?
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/25 px-3.5 py-2.5 sm:px-4">
            {receivedPhotos.length > 0 ?
              <ReceivedPhotosViewer
                photos={receivedPhotos}
                triggerLabel="Received condition photo"
              />
            : null}
            {receiptUrl ?
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={previewPhotoLinkClassName}
                title="Open receipt photo in a new tab"
              >
                <ImageIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Receipt photo
                <ExternalLinkIcon className="size-3 shrink-0 opacity-60" aria-hidden />
              </a>
            : null}
          </div>
        : null
      : <div className="border-t border-border/60 bg-muted/25 px-3.5 py-2.5 sm:px-4">
          <a
            href={row.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={previewPhotoLinkClassName}
          >
            Open product page
            <ExternalLinkIcon className="size-3 shrink-0 opacity-60" aria-hidden />
          </a>
        </div>
      }
    </div>
  );
}

function SnapshotMetaSection({
  row,
  prevRow,
  isBatchedProduct,
  auditStatusContext,
  hideDuplicateChangeSummary = false,
}: {
  row: ItemRequestLineSnapshot;
  prevRow: ItemRequestLineSnapshot | null;
  isBatchedProduct: boolean;
  auditStatusContext?: AuditSnapshotStatusContext;
  hideDuplicateChangeSummary?: boolean;
}) {
  const changeSummary = auditSnapshotChangeSummary(row, prevRow);
  const isDuplicateCopy = isDuplicateFrozenCopySnapshotSummary(changeSummary);
  const showChangeSummary = !hideDuplicateChangeSummary || !isDuplicateCopy;
  const isCheckoutPaid = row.phase === "outside_purchase_checkout_paid";

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 shadow-sm",
        isCheckoutPaid ?
          "border-emerald-500/25 bg-emerald-500/[0.06]"
        : "border-border/80 bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {snapshotPhaseDisplayLabel(row.phase, { isBatchedProduct })}
          </p>
          <p className="text-sm font-semibold leading-snug text-foreground">
            {auditSnapshotStatusHeadline(row, auditStatusContext)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recorded
          </p>
          <time
            dateTime={row.createdAt}
            className="text-sm tabular-nums text-foreground"
          >
            {new Date(row.createdAt).toLocaleString()}
          </time>
        </div>
      </div>
      {showChangeSummary ?
        <p
          className={cn(
            "mt-2.5 text-sm leading-relaxed text-muted-foreground",
            isDuplicateCopy &&
              "rounded-md border border-border/50 bg-background/60 px-2.5 py-2 text-xs italic",
          )}
        >
          {changeSummary}
        </p>
      : null}
    </div>
  );
}

export function ItemRequestLineSnapshotPreviewPanel({
  row,
  prevRow,
  urlExtra,
  showInternalIds = false,
  warehouseProofPhotoUrls,
  receivedProductPhotos,
  receiptPhotoUrl,
  productImageUrl,
  replaceNoteWithEstimate = false,
  estimateNote,
  estimateTotalCents,
  estimateQuote = null,
  batchShare,
  batchEstimateNote,
  isBatchedProduct = false,
  auditSnapshots = null,
  receivedConditionRaw = null,
  hideDuplicateChangeSummary = false,
}: {
  row: ItemRequestLineSnapshot;
  prevRow: ItemRequestLineSnapshot | null;
  urlExtra?: ReactNode;
  showInternalIds?: boolean;
  /** Live order-line proof URLs when snapshot memo is v1 or lacks URLs. */
  warehouseProofPhotoUrls?: string[] | null;
  /** Received product photos (condition + product) for outside-purchase lines. */
  receivedProductPhotos?: ReceivedProductPhoto[] | null;
  /** Receipt photo for outside-purchase lines (separate link). */
  receiptPhotoUrl?: string | null;
  /** Fallback product image when the snapshot row has none. */
  productImageUrl?: string | null;
  /** Hide the customer note and show the staff estimate note instead. */
  replaceNoteWithEstimate?: boolean;
  /** Staff note from the linked estimate (shown when replaceNoteWithEstimate). */
  estimateNote?: string | null;
  /** Linked estimate total (cents); shows an "Estimate total" block when set. */
  estimateTotalCents?: number | null;
  /** Linked quote for single-product estimate breakdown rows. */
  estimateQuote?: ItemQuote | null;
  /**
   * This product's slice of its saved batch estimate. When set, replaces the
   * single product estimate total with the batch estimate share breakdown.
   */
  batchShare?: BatchLineShare | null;
  /** Batch estimate note (staff); shown instead of the single estimate note when batched. */
  batchEstimateNote?: string | null;
  isBatchedProduct?: boolean;
  /** Full snapshot history for outside-purchase parent/child audit UI. */
  auditSnapshots?: readonly ItemRequestLineSnapshot[] | null;
  /** Live request received condition fallback for published status labels. */
  receivedConditionRaw?: string | null;
  /** Omit the duplicate frozen-copy change summary (customer product history). */
  hideDuplicateChangeSummary?: boolean;
}) {
  const structuredAudit = hasStructuredAuditMemo(row);
  const customerNote = customerNoteWithoutReportedPrice(row.note);
  const useStaffEstimateNote =
    replaceNoteWithEstimate &&
    shouldShowStaffEstimatePreviewForSnapshotPhase(row.phase);
  const showNote =
    !useStaffEstimateNote &&
    !structuredAudit &&
    (row.phase === "customer_submission" ||
      row.phase === "customer_line_edit" ||
      Boolean(customerNote?.trim()));
  const showBatchShare =
    useStaffEstimateNote &&
    batchShare != null &&
    shouldShowBatchEstimateShareForSnapshotPhase(row.phase);
  const showSingleQuoteBreakdown =
    useStaffEstimateNote &&
    !showBatchShare &&
    shouldShowSingleQuoteBreakdownForSnapshotPhase(row.phase);
  const linkedQuote = estimateQuote ?? null;
  const hideProductLine = showBatchShare || showSingleQuoteBreakdown;
  const isOutsidePurchase = isOutsidePurchaseProductUrl(row.productUrl ?? "");
  const returnRequestNote = productReturnRequestNoteForSnapshot(row, auditSnapshots);
  const showReturnRequestNotes =
    row.phase === "product_return_tracking_saved" ||
    row.phase === "product_return_requested";
  const auditStatusContext: AuditSnapshotStatusContext | undefined =
    auditSnapshots || receivedConditionRaw || estimateNote || linkedQuote?.staffNote ?
      {
        snapshots: auditSnapshots ?? undefined,
        quoteStaffNote: estimateNote ?? linkedQuote?.staffNote ?? null,
        receivedConditionRaw,
      }
    : undefined;

  return (
    <div className="space-y-4 text-foreground">
      <SnapshotMetaSection
        row={row}
        prevRow={prevRow}
        isBatchedProduct={isBatchedProduct}
        auditStatusContext={auditStatusContext}
        hideDuplicateChangeSummary={hideDuplicateChangeSummary}
      />

      {showBatchShare && batchShare ?
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Batch estimate share (this product)
          </p>
          <ul className="mt-2 space-y-1.5 text-sm tabular-nums text-muted-foreground">
            <li className="flex justify-between gap-2">
              <span>Merchandise total</span>
              <span className="text-foreground">{formatUsd(batchShare.merchandise)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Service &amp; handling</span>
              <span className="text-foreground">{formatUsd(batchShare.serviceFee)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Shipping (est.)</span>
              <span className="text-foreground">{formatUsd(batchShare.shipping)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Tax / sale tax</span>
              <span className="text-foreground">{formatUsd(batchShare.tax)}</span>
            </li>
            <li className="flex justify-between gap-2 border-t border-primary/20 pt-2 font-semibold text-foreground">
              <span>Total</span>
              <span>{formatUsd(batchShare.total)}</span>
            </li>
          </ul>
        </div>
      : showSingleQuoteBreakdown ?
        <SingleQuoteBreakdown quote={linkedQuote} title="Single product estimate" />
      : useStaffEstimateNote && estimateTotalCents != null ?
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estimate total
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {formatUsd(estimateTotalCents)}
          </p>
        </div>
      : null}

      {isWarehouseReceiptPhase(row.phase) ?
        <WarehouseReceiptSnapshotPanel
          row={row}
          warehouseProofPhotoUrls={warehouseProofPhotoUrls}
        />
      : null}
      {row.phase === "product_return_tracking_saved" ?
        <ProductReturnTrackingSnapshotPanel row={row} />
      : null}
      {showReturnRequestNotes ?
        <ProductReturnRequestNotesPanel note={returnRequestNote} />
      : null}
      {row.phase === "customer_refund_request_submitted" ?
        <CustomerRefundRequestSnapshotPanel row={row} />
      : null}

      {!hideProductLine ?
        <ProductContextSection
          row={row}
          receivedProductPhotos={receivedProductPhotos}
          receiptPhotoUrl={receiptPhotoUrl}
          productImageUrl={productImageUrl}
        />
      : null}

      {urlExtra ? <div>{urlExtra}</div> : null}

      {showNote ?
        <PreviewSectionCard title="Customer note">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {customerNote?.trim() || "—"}
          </p>
        </PreviewSectionCard>
      : null}

      {useStaffEstimateNote ?
        <StaffEstimateNotePanel
          note={
            showBatchShare ?
              batchEstimateNote?.trim() ||
              "No batch estimate note was added by staff."
            : estimateNote?.trim() || ""
          }
          title={showBatchShare ? "Batch estimate note" : "Estimate note (staff)"}
          isOutsidePurchase={isOutsidePurchase}
        />
      : null}

      <SnapshotAuditMemoDisplay row={row} />

      {showInternalIds ?
        <>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quote id
            </p>
            <p className="mt-1 break-all font-mono text-sm text-muted-foreground">
              {row.itemQuoteId ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Snapshot id
            </p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {row.id}
            </p>
          </div>
        </>
      : null}
    </div>
  );
}
