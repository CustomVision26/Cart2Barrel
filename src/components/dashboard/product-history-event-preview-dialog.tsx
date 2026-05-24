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
import { ItemRequestLineSnapshotPreviewPanel } from "@/components/orders/item-request-line-snapshot-preview-panel";
import type { ItemRequest, ItemRequestLineSnapshot } from "@/db/schema";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";

export type ProductHistoryTimelinePreview =
  | {
      kind: "snapshot";
      snapshot: ItemRequestLineSnapshot;
      prevSnapshot: ItemRequestLineSnapshot | null;
      warehouseProofPhotoUrls?: string[] | null;
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
  preview,
  triggerLabel = "View record",
}: {
  eventLabel: string;
  eventHeadline: string;
  preview: ProductHistoryTimelinePreview;
  triggerLabel?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,46rem)] w-[min(96vw,56rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{eventHeadline}</DialogTitle>
          <DialogDescription>{eventLabel}</DialogDescription>
        </DialogHeader>
        {preview.kind === "snapshot" ?
          <ItemRequestLineSnapshotPreviewPanel
            row={preview.snapshot}
            prevRow={preview.prevSnapshot}
            warehouseProofPhotoUrls={preview.warehouseProofPhotoUrls}
          />
        : <CurrentProductStatusPreviewPanel
            request={preview.request}
            statusLabel={preview.statusLabel}
          />
        }
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
