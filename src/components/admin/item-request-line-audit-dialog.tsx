"use client";

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
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";
import { displaySiteName } from "@/lib/site-name";

import { AdminProductUrlDialog } from "./admin-product-url-dialog";

function AuditSnapshotPreviewPanel({ row }: { row: ItemRequestLineSnapshot }) {
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
          <p className="tabular-nums">{row.quantity}</p>
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
};

export function ItemRequestLineAuditDialog({
  itemRequestId,
  productLabel,
  snapshots,
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        Audit trail
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
            <div className="min-w-0 overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[56rem] text-left text-sm sm:text-[0.9375rem]">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-3 py-3 font-medium text-foreground">Phase</th>
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
                  {displaySnapshots.map((row) => {
                    const selected = previewId === row.id;
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
                          {row.quantity}
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
            </div>
            <aside className="rounded-xl border border-border bg-muted/15 p-4 lg:max-h-[min(52rem,72vh)] lg:overflow-y-auto">
              {previewRow ? (
                <AuditSnapshotPreviewPanel row={previewRow} />
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
