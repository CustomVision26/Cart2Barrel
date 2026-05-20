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
import { parseWarehouseReceiptMemo } from "@/lib/warehouse-receipt-snapshot-memo";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import { displaySiteName } from "@/lib/site-name";

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
}: {
  row: ItemRequestLineSnapshot;
}) {
  const wr = parseWarehouseReceiptMemo(row.auditMemo);
  if (!wr) return null;
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        Warehouse receipt details
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
          <dd className="tabular-nums">{wr.proofPhotoCount}</dd>
        </div>
        {wr.barcodeValue?.trim() ?
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Barcode / SKU</dt>
            <dd className="mt-0.5 font-mono text-xs">{wr.barcodeValue.trim()}</dd>
          </div>
        : null}
      </dl>
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

export function ItemRequestLineSnapshotPreviewPanel({
  row,
  prevRow,
  urlExtra,
  showInternalIds = false,
}: {
  row: ItemRequestLineSnapshot;
  prevRow: ItemRequestLineSnapshot | null;
  urlExtra?: ReactNode;
  showInternalIds?: boolean;
}) {
  return (
    <div className="space-y-4 text-foreground">
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
      {row.phase === "warehouse_delivery_received" ?
        <WarehouseReceiptSnapshotPanel row={row} />
      : null}
      {row.phase === "product_return_tracking_saved" ?
        <ProductReturnTrackingSnapshotPanel row={row} />
      : null}
      {row.phase === "customer_refund_request_submitted" ?
        <CustomerRefundRequestSnapshotPanel row={row} />
      : null}
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
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Product
        </p>
        <p className="text-lg font-semibold leading-snug">
          {row.productName?.trim() || "—"}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Site name
        </p>
        <p className="text-base text-foreground">
          {displaySiteName(row.siteName, row.productUrl)}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-base">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Qty
          </p>
          <p className="tabular-nums">
            {row.phase === "warehouse_delivery_received" ?
              (() => {
                const wrMemo = parseWarehouseReceiptMemo(row.auditMemo);
                return wrMemo ?
                    `${wrMemo.receivedQty} received (ordered ${wrMemo.orderedQty})`
                  : row.quantity;
              })()
            : row.quantity}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Size
          </p>
          <p>{row.productSize?.trim() || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Color
          </p>
          <p>{row.productColor?.trim() || "—"}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Product page URL
        </p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <a
            href={row.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 break-all text-base font-medium text-primary underline-offset-4 hover:underline"
          >
            Open link
            <ExternalLinkIcon className="size-4 shrink-0" aria-hidden />
          </a>
          {urlExtra}
        </div>
        <p className="mt-2 break-all rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {row.productUrl}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Note
        </p>
        <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground">
          {row.note?.trim() || "—"}
        </p>
      </div>
      {row.auditMemo?.trim() && row.phase !== "customer_refund_request_submitted" ?
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Record details
          </p>
          <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/25 px-3 py-3 text-sm leading-relaxed text-foreground">
            {row.auditMemo.trim()}
          </p>
        </div>
      : null}
      {row.productImageUrl?.trim() ?
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product image
          </p>
          <a
            href={row.productImageUrl.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block max-w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.productImageUrl.trim()}
              alt={row.productName?.trim() || "Product snapshot"}
              className="max-h-64 max-w-full rounded-lg border border-border object-contain"
            />
          </a>
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
