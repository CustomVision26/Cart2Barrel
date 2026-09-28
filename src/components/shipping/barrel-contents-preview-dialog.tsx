"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, EyeIcon } from "lucide-react";
import { toast } from "sonner";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/admin-markup";
import {
  barrelContentsDownloadFilename,
  barrelContentsTotalCents,
  barrelContentUnitPriceCents,
  type BarrelContentItem,
} from "@/lib/barrel-contents";

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

type BarrelContentsPreviewDialogProps = {
  barrelId: string;
  containerLabel: string;
  containerAlias?: string;
  items: BarrelContentItem[];
  contentsApiPath?: string;
};

export function BarrelContentsPreviewDialog({
  barrelId,
  containerLabel,
  containerAlias,
  items,
  contentsApiPath = "/api/dashboard/barrel-contents",
}: BarrelContentsPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(5);
  const [downloading, startDownload] = useTransition();
  const totalCents = barrelContentsTotalCents(items);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSafe, pageSize]);
  const from = items.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const to = Math.min(pageSafe * pageSize, items.length);

  function downloadPdf() {
    startDownload(async () => {
      const response = await fetch(
        `${contentsApiPath}?barrelId=${encodeURIComponent(barrelId)}`,
      );
      if (!response.ok) {
        toast.error("Could not download the contents PDF.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = barrelContentsDownloadFilename(
        containerAlias || containerLabel,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <EyeIcon data-icon="inline-start" />
        Preview contents
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setPage(1);
        }}
      >
        <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="gap-2 pr-8">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Container contents
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Products packed in{" "}
              <span className="font-medium text-foreground">{containerLabel}</span>
              {containerAlias ? ` (${containerAlias})` : null}.{" "}
              {items.length} item{items.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          {items.length === 0 ?
            <p className="text-sm text-muted-foreground">
              No products are packed in this container yet.
            </p>
          : (
            <div className="space-y-3">
              <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/80">
                {pageItems.map((item) => {
                  const unitCents = barrelContentUnitPriceCents(item);
                  return (
                    <li
                      key={item.packageId}
                      className="flex items-start gap-3 bg-card px-3 py-3"
                    >
                      <ProductRequestThumbnail
                        variant="admin"
                        imageUrl={item.productImageUrl}
                        productLabel={item.productName}
                        className="rounded-md"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {item.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            item.productSize ? `Size: ${item.productSize}` : null,
                            item.productColor ? `Color: ${item.productColor}` : null,
                            `Units/pack ${item.unitsPerPack}`,
                            `Qty ${item.quantity}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {unitCents != null ?
                            `${formatUsd(unitCents)} each · `
                          : null}
                          {formatUsd(item.linePriceCents)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>
                  Showing {from}–{to} of {items.length}
                </p>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5">
                    <span>Per page</span>
                    <select
                      className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(
                          Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number],
                        );
                        setPage(1);
                      }}
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <nav className="flex items-center gap-1" aria-label="Contents pages">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      disabled={pageSafe <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeftIcon />
                      <span className="sr-only">Previous page</span>
                    </Button>
                    <span className="min-w-12 text-center tabular-nums">
                      {pageSafe} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      disabled={pageSafe >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRightIcon />
                      <span className="sr-only">Next page</span>
                    </Button>
                  </nav>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <p className="mr-auto text-sm font-medium tabular-nums text-foreground">
              Total {formatUsd(totalCents)}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={items.length === 0 || downloading}
              onClick={downloadPdf}
            >
              <DownloadIcon data-icon="inline-start" />
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
