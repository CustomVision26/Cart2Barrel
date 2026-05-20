"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  auditSnapshotChangeSummary,
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import { parseProductReturnTrackingMemo } from "@/lib/product-return-tracking-memo";
import {
  parseRefundRequestAuditMemo,
  refundRequestReasonKindLabel,
} from "@/lib/refund-request-audit-memo";
import { parseWarehouseReceiptMemo } from "@/lib/warehouse-receipt-snapshot-memo";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import { displaySiteName } from "@/lib/site-name";

import { AdminProductUrlDialog } from "./admin-product-url-dialog";

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
            {memo.trackingUrl?.trim() || "—"}
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
  const panelTitle =
    wr.intakeRole === "prior" ?
      "Prior warehouse intake (archived)"
    : wr.intakeContext === "replacement_after_return" ?
      "Replacement inbound receipt"
    : "Warehouse receipt details";
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
            "text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
          : "text-xs font-medium uppercase tracking-wide text-primary"
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
          <dt className="text-xs font-medium text-muted-foreground">
            Ordered qty
          </dt>
          <dd className="tabular-nums font-medium">{wr.orderedQty}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Received qty
          </dt>
          <dd className="tabular-nums font-medium">{wr.receivedQty}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Condition
          </dt>
          <dd>{warehouseReceiveConditionLabel(wr.condition)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Shelf / bin
          </dt>
          <dd>{wr.shelfLocation.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Proof photos
          </dt>
          <dd className="tabular-nums">{wr.proofPhotoCount}</dd>
          {wr.proofPhotoUrls && wr.proofPhotoUrls.length > 0 ?
            <ul className="mt-1 list-inside list-disc text-xs text-primary">
              {wr.proofPhotoUrls.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    Open photo
                  </a>
                </li>
              ))}
            </ul>
          : null}
        </div>
        {wr.barcodeValue?.trim() ?
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              Barcode / SKU
            </dt>
            <dd className="mt-0.5 font-mono text-xs">{wr.barcodeValue.trim()}</dd>
          </div>
        : null}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Product image below is the request-line snapshot. Proof counts are recorded above;
        barcode photos from shoppers/staff are stored as URLs on the order line (Vercel Blob).
      </p>
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
        Customer refund submission
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Reason category</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {refundRequestReasonKindLabel(memo.reasonKind)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">
            Amount preference
          </dt>
          <dd className="mt-0.5 text-foreground">{amountLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">
            Explanation (customer)
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {memo.details.trim() || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AuditSnapshotPreviewPanel({
  row,
  prevRow,
}: {
  row: ItemRequestLineSnapshot;
  prevRow: ItemRequestLineSnapshot | null;
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
      {row.phase === "warehouse_delivery_received" ||
      row.phase === "warehouse_delivery_received_prior" ?
        <WarehouseReceiptSnapshotPanel row={row} />
      : null}
      {row.phase === "product_return_tracking_saved" ? (
        <ProductReturnTrackingSnapshotPanel row={row} />
      ) : null}
      {row.phase === "customer_refund_request_submitted" ? (
        <CustomerRefundRequestSnapshotPanel row={row} />
      ) : null}
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
            {row.phase === "warehouse_delivery_received" ||
            row.phase === "warehouse_delivery_received_prior" ?
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
          <AdminProductUrlDialog productUrl={row.productUrl} />
        </div>
        <p className="mt-2 break-all rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {row.productUrl}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Note
        </p>
        <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-3 text-base leading-relaxed text-foreground">
          {row.note?.trim() || "—"}
        </p>
      </div>
      {row.auditMemo?.trim() ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Batch / estimate audit memo
          </p>
          <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/25 px-3 py-3 font-mono text-xs leading-relaxed text-foreground">
            {row.auditMemo.trim()}
          </p>
        </div>
      ) : null}
      {row.productImageUrl?.trim() ? (
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
            <img
              src={row.productImageUrl.trim()}
              alt={row.productName?.trim() || "Product snapshot"}
              className="max-h-64 max-w-full rounded-lg border border-border object-contain"
            />
          </a>
        </div>
      ) : null}
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
    </div>
  );
}

type ItemRequestLineAuditDialogProps = {
  itemRequestId: string;
  productLabel: string;
  snapshots: ItemRequestLineSnapshot[];
  triggerLabel?: string;
};

export function ItemRequestLineAuditDialog({
  itemRequestId,
  productLabel,
  snapshots,
  triggerLabel = "Audit trail",
}: ItemRequestLineAuditDialogProps) {
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const displaySnapshots = snapshots.filter(
    (row) => row.phase !== "pre_admin_estimate_edit"
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
    previewRow && previewIndex > 0 ?
      (displaySnapshots[previewIndex - 1] ?? null)
    : null;

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
          <DialogDescription className="text-sm sm:text-base">
            Frozen copies of what the customer submitted and what staff saved with each
            estimate. Double-click a row for a full preview. Request id:{" "}
            <span className="font-mono text-xs sm:text-sm">{itemRequestId}</span>
            {productLabel.trim() ? (
              <>
                {" "}
                · <span className="font-medium text-foreground">{productLabel}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {displaySnapshots.length === 0 ? (
          <p className="text-base text-muted-foreground">
            No audit rows yet. Older requests created before this feature only appear here
            after the next customer submission or staff estimate save.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_min(22rem,34%)] lg:items-start">
            <FloatingHorizontalScroll className="min-w-0" viewportClassName="rounded-md border border-border">
              <table className="w-full min-w-[72rem] text-left text-sm sm:text-[0.9375rem]">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-3 py-3 font-medium text-foreground">Phase</th>
                    <th className="px-3 py-3 font-medium text-foreground">Status</th>
                    <th className="px-3 py-3 font-medium text-foreground">Time</th>
                    <th className="px-3 py-3 font-medium text-foreground">Product</th>
                    <th className="px-3 py-3 font-medium text-foreground">URL</th>
                    <th className="px-3 py-3 font-medium text-foreground">Size</th>
                    <th className="px-3 py-3 font-medium text-foreground">Color</th>
                    <th className="px-3 py-3 font-medium text-foreground">Qty</th>
                    <th className="px-3 py-3 font-medium text-foreground">Note</th>
                    <th className="px-3 py-3 font-medium text-foreground">Quote id</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displaySnapshots.map((row, rowIndex) => {
                    const wrMemo = parseWarehouseReceiptMemo(row.auditMemo);
                    const selected = previewId === row.id;
                    const prevRow =
                      rowIndex > 0 ? (displaySnapshots[rowIndex - 1] ?? null) : null;
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer align-top transition-colors hover:bg-muted/30 ${
                          selected
                            ? "bg-primary/10 ring-1 ring-inset ring-primary/25"
                            : ""
                        }`}
                        title="Double-click for full preview"
                        onDoubleClick={() =>
                          setPreviewId((prev) => (prev === row.id ? null : row.id))
                        }
                      >
                        <td className="whitespace-nowrap px-3 py-3 text-foreground">
                          {itemRequestLineSnapshotPhaseLabel(row.phase)}
                        </td>
                        <td className="max-w-[22rem] px-3 py-3 align-top text-foreground">
                          <span className="line-clamp-2 font-medium leading-snug">
                            {auditSnapshotStatusHeadline(row)}
                          </span>
                          <span className="mt-1 block line-clamp-3 whitespace-normal text-xs leading-relaxed text-muted-foreground">
                            {auditSnapshotChangeSummary(row, prevRow)}
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
                            <AdminProductUrlDialog productUrl={row.productUrl} />
                          </span>
                        </td>
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
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground sm:text-sm">
                          {row.itemQuoteId?.slice(0, 8) ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </FloatingHorizontalScroll>
            <aside className="rounded-xl border border-border bg-muted/15 p-4 lg:max-h-[min(52rem,72vh)] lg:overflow-y-auto">
              {previewRow ? (
                <AuditSnapshotPreviewPanel row={previewRow} prevRow={previewPrev} />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Preview</span> — double-click a
                  row in the table to see the full record: URL, complete note, image (if any),
                  and ids.
                </p>
              )}
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
