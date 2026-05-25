import type { ReactNode } from "react";
import { ExternalLinkIcon } from "lucide-react";

import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import { parseProductReturnTrackingMemo } from "@/lib/product-return-tracking-memo";
import {
  parseRefundRequestAuditMemo,
  refundRequestReasonKindLabel,
} from "@/lib/refund-request-audit-memo";
import {
  parseWarehouseReceiptMemo,
  warehouseReceiptIntakePhotoUrls,
} from "@/lib/warehouse-receipt-snapshot-memo";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { displaySiteName } from "@/lib/site-name";

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

function ProductContextSection({ row }: { row: ItemRequestLineSnapshot }) {
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
  const detailRows = [
    { label: "Qty", value: qtyLabel },
    ...(size ? [{ label: "Size", value: size }] : []),
    ...(color ? [{ label: "Color", value: color }] : []),
  ];

  const thumbnail = (
    <ProductRequestThumbnail
      variant="dialog"
      imageUrl={row.productImageUrl}
      productLabel={productName}
    />
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      <div className="flex gap-3 p-3">
        {row.productImageUrl?.trim() ?
          <a
            href={row.productImageUrl.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 transition-opacity hover:opacity-90"
            title="Open catalog listing image"
          >
            {thumbnail}
          </a>
        : thumbnail}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product line
          </p>
          <div>
            <p className="font-medium leading-snug text-foreground">{productName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{siteName}</p>
          </div>
          <dl className="space-y-1 border-t border-border/60 pt-2 text-xs sm:text-sm">
            {detailRows.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-x-4 gap-y-0.5"
              >
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 text-right font-medium tabular-nums text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="border-t border-border/60 bg-muted px-3 py-2">
        <a
          href={row.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline sm:text-sm"
        >
          Open product page
          <ExternalLinkIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        </a>
      </div>
    </div>
  );
}

export function ItemRequestLineSnapshotPreviewPanel({
  row,
  prevRow,
  urlExtra,
  showInternalIds = false,
  warehouseProofPhotoUrls,
}: {
  row: ItemRequestLineSnapshot;
  prevRow: ItemRequestLineSnapshot | null;
  urlExtra?: ReactNode;
  showInternalIds?: boolean;
  /** Live order-line proof URLs when snapshot memo is v1 or lacks URLs. */
  warehouseProofPhotoUrls?: string[] | null;
}) {
  const structuredAudit = hasStructuredAuditMemo(row);
  const showNote = !structuredAudit && Boolean(row.note?.trim());
  const showRawAuditMemo = !structuredAudit && Boolean(row.auditMemo?.trim());

  return (
    <div className="space-y-4 text-foreground">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Phase
          </p>
          <p className="text-base font-medium">
            {itemRequestLineSnapshotPhaseLabel(row.phase)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <p className="text-base font-medium leading-snug">
            {auditSnapshotStatusHeadline(row)}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {auditSnapshotChangeSummary(row, prevRow)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recorded at
          </p>
          <p className="text-base text-foreground">
            <time dateTime={row.createdAt}>
              {new Date(row.createdAt).toLocaleString()}
            </time>
          </p>
        </div>
      </div>

      {isWarehouseReceiptPhase(row.phase) ?
        <WarehouseReceiptSnapshotPanel
          row={row}
          warehouseProofPhotoUrls={warehouseProofPhotoUrls}
        />
      : null}
      {row.phase === "product_return_tracking_saved" ?
        <ProductReturnTrackingSnapshotPanel row={row} />
      : null}
      {row.phase === "customer_refund_request_submitted" ?
        <CustomerRefundRequestSnapshotPanel row={row} />
      : null}

      <ProductContextSection row={row} />

      {urlExtra ? <div>{urlExtra}</div> : null}

      {showNote ?
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Note
          </p>
          <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground">
            {row.note?.trim()}
          </p>
        </div>
      : null}

      {showRawAuditMemo ?
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Record details
          </p>
          <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted px-3 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {row.auditMemo?.trim()}
          </p>
        </div>
      : null}

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
