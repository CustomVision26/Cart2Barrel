"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitProductReturnRequestAction } from "@/actions/submit-product-return-request";
import { ProductReturnDesiredOutcomeOptions } from "@/components/dashboard/product-return-desired-outcome-options";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import { formatUsd } from "@/lib/admin-markup";
import { dashboardShowsProductReturnButton } from "@/lib/order-line-product-return-eligibility";
import type { ProductReturnDesiredOutcome } from "@/lib/product-return-desired-outcome";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";

function ProductReturnSummaryCard({ row }: { row: DashboardPaidOrderLineRow }) {
  const r = row.request;
  const productName = r.productName?.trim() || "Unnamed product";
  const site = displaySiteName(r.siteName, r.productUrl);
  const size = r.productSize?.trim();
  const color = r.productColor?.trim();
  const batchLabel =
    row.resolvedBatchNumber?.trim() ||
    (row.resolvedBatchSessionId?.trim() ?
      `Batch ${row.resolvedBatchSessionId.trim().slice(0, 8)}…`
    : null);

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-muted p-3">
      <ProductRequestThumbnail
        variant="list"
        imageUrl={r.productImageUrl}
        productLabel={productName}
        className="size-16 shrink-0"
      />
      <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div>
          <dt className="sr-only">Product</dt>
          <dd className="font-medium leading-snug text-foreground">{productName}</dd>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{site}</span>
          <span className="tabular-nums">Qty {row.orderItem.quantity}</span>
          <span className="tabular-nums">{formatUsd(row.orderItem.price)}</span>
        </div>
        {size || color ?
          <div className="text-xs text-muted-foreground">
            {[size ? `Size ${size}` : null, color ? `Color ${color}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        : null}
        {batchLabel ?
          <div className="text-xs text-muted-foreground">Batch {batchLabel}</div>
        : null}
        <div className="text-xs text-muted-foreground">
          Order{" "}
          <span className="font-mono" title={row.order.id}>
            {row.order.id.slice(0, 8)}…
          </span>
        </div>
        <div>
          <Link
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            View product URL
          </Link>
        </div>
      </dl>
    </div>
  );
}

export function DashboardProductReturnRequestDialog({
  row,
}: {
  row: DashboardPaidOrderLineRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [desiredOutcome, setDesiredOutcome] =
    useState<ProductReturnDesiredOutcome | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [confirmCharges, setConfirmCharges] = useState(false);
  const [pending, startTransition] = useTransition();

  const canRequest = dashboardShowsProductReturnButton({
    request: row.request,
    orderItem: row.orderItem,
    order: row.order,
    refundedCents: row.refundedCents,
    pendingProductReturnRequest: row.pendingProductReturnRequest != null,
    pendingRefundRequest: row.pendingRefundRequest != null,
  });

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setDesiredOutcome(null);
      setReturnNote("");
      setConfirmCharges(false);
    }
  }, []);

  const submit = useCallback(() => {
    startTransition(async () => {
      if (!desiredOutcome) return;
      const res = await submitProductReturnRequestAction({
        orderItemId: row.orderItem.id,
        desiredOutcome,
        returnNote,
        acknowledgeChargesMayApply: true,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [desiredOutcome, returnNote, row.orderItem.id, router]);

  if (!canRequest) return null;

  const noteReady = returnNote.trim().length >= 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "mt-2 w-full",
        )}
      >
        Return product
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Return product</DialogTitle>
          <DialogDescription>
            Ask Cart2Barrel to return this item to the retailer on your behalf.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <ProductReturnSummaryCard row={row} />

          <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 text-muted-foreground">
            <p className="font-medium text-foreground">How returns work</p>
            <p className="mt-2 leading-relaxed">
              Cart2Barrel staff will handle the physical product, work with the
              shipping carrier, and complete the return transaction with the retailer.
            </p>
            <p className="mt-2 leading-relaxed">
              After you submit, staff review your request and update this order when
              return tracking is in place.
            </p>
          </div>

          <ProductReturnDesiredOutcomeOptions
            namePrefix={row.orderItem.id}
            value={desiredOutcome}
            onChange={setDesiredOutcome}
            disabled={pending}
          />

          <div className="grid gap-2">
            <Label htmlFor={`return-note-${row.orderItem.id}`}>
              Why are you requesting a return?
            </Label>
            <textarea
              id={`return-note-${row.orderItem.id}`}
              className="min-h-[7rem] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="Describe the issue (wrong size, damaged, changed mind, retailer policy, etc.). Staff use this when arranging the return shipment."
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              {returnNote.trim().length}/2000 · at least 20 characters
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmCharges}
              onChange={(e) => setConfirmCharges(e.target.checked)}
            />
            <span>
              I understand additional service, shipping, or price-difference
              charges may or may not apply to my return or replacement, and staff
              will confirm before any extra charge.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            disabled={
              pending ||
              desiredOutcome == null ||
              !confirmCharges ||
              !noteReady
            }
            onClick={submit}
          >
            {pending ? "Submitting…" : "Submit return request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
