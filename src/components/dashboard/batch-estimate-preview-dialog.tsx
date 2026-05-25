"use client";

import { EyeIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toast } from "sonner";

import { requestBatchEstimateRevisionAction } from "@/actions/customer-batch-quote";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { BatchQuoteEstimate } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  dashItemsTableStatusPanel,
  dashItemsTimelineCard,
} from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

type BatchEstimatePreviewDialogProps = {
  batchSessionId: string;
  batchNumber: string;
  siteKey: string;
  estimate: BatchQuoteEstimate;
};

export function BatchEstimatePreviewDialog({
  batchSessionId,
  batchNumber,
  siteKey,
  estimate,
}: BatchEstimatePreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmRevisionOpen, setConfirmRevisionOpen] = useState(false);
  const [revisionPending, revisionStart] = useTransition();

  const subtotalCalc =
    estimate.siteMerchandiseTotalCents +
    estimate.serviceHandlingTotalCents +
    estimate.siteSaleTaxTotalCents +
    estimate.siteShippingTotalCents;

  const cancelRevisionConfirm = () => {
    setConfirmRevisionOpen(false);
  };

  const confirmRevision = () => {
    revisionStart(async () => {
      const res = await requestBatchEstimateRevisionAction({ batchSessionId });
      setConfirmRevisionOpen(false);
      if (!res.ok) {
        toast.error(res.message ?? "Could not submit request.");
        return;
      }
      toast.success(res.message ?? "Requested.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmRevisionOpen(false);
        }}
      >
        <DialogTrigger
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
          Preview estimate
        </DialogTrigger>
        <DialogContent className="max-h-[min(85vh,560px)] w-[min(96vw,26rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch estimate</DialogTitle>
            <DialogDescription>
              Batch{" "}
              <span className="font-mono font-medium text-foreground">{batchNumber}</span>
              {" · "}
              <span className="text-muted-foreground">{siteKey}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm tabular-nums">
            <div className={cn("grid gap-2", dashItemsTableStatusPanel)}>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Batch merchandise total</span>
                <span className="text-foreground">
                  {formatUsd(estimate.batchMerchandiseTotalCents)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Site merchandise</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteMerchandiseTotalCents)}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Item discount</span>
                <span className="text-foreground">{formatUsd(estimate.itemDiscountCents)}</span>
              </div>
              <div className="flex justify-between gap-2 border-t border-border pt-2">
                <span className="text-muted-foreground">Service &amp; handling</span>
                <span className="text-foreground">
                  {formatUsd(estimate.serviceHandlingTotalCents)}
                </span>
              </div>
            </div>

            <div className={cn("grid gap-2", dashItemsTableStatusPanel)}>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Batch shipping</span>
                <span className="text-foreground">
                  {formatUsd(estimate.batchShippingTotalCents)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Site shipping</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteShippingTotalCents)}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Shipping discount</span>
                <span className="text-foreground">{formatUsd(estimate.shippingDiscountCents)}</span>
              </div>
            </div>

            <div className={cn("grid gap-2", dashItemsTableStatusPanel)}>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Batch sale tax</span>
                <span className="text-foreground">
                  {formatUsd(estimate.batchSaleTaxTotalCents)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Site sale tax</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteSaleTaxTotalCents)}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Sale tax discount</span>
                <span className="text-foreground">{formatUsd(estimate.saleTaxDiscountCents)}</span>
              </div>
            </div>

            <Separator />

            <ul className="space-y-2 text-muted-foreground">
              <li className="flex justify-between gap-2">
                <span>Site merchandise</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteMerchandiseTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Service &amp; handling</span>
                <span className="text-foreground">
                  {formatUsd(estimate.serviceHandlingTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Site shipping</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteShippingTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Site sale tax</span>
                <span className="text-foreground">
                  {formatUsd(estimate.siteSaleTaxTotalCents)}
                </span>
              </li>
              <li className="flex justify-between gap-2 border-t border-border pt-2 font-semibold text-foreground">
                <span>Customer subtotal</span>
                <span>{formatUsd(subtotalCalc)}</span>
              </li>
            </ul>

            <div className={cn("flex justify-between text-xs tabular-nums", dashItemsTimelineCard)}>
              <span className="text-muted-foreground">Saved subtotal (staff)</span>
              <span className="font-medium text-foreground">
                {formatUsd(estimate.subtotalCents)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Customer subtotal is site merchandise + service &amp; handling + site sale tax +
              site shipping. The saved subtotal is what staff recorded for this batch.
            </p>
            <p className="text-xs text-muted-foreground">
              Saved{" "}
              <time dateTime={estimate.createdAt}>
                {new Date(estimate.createdAt).toLocaleString()}
              </time>
              .
            </p>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:min-w-0 sm:flex-1"
                onClick={() => setConfirmRevisionOpen(true)}
              >
                Request estimate
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:min-w-0 sm:flex-1"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmRevisionOpen}
        onOpenChange={(next) => {
          if (!next && revisionPending) return;
          setConfirmRevisionOpen(next);
        }}
      >
        <DialogContent showCloseButton={false} className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a revised batch estimate?</DialogTitle>
            <DialogDescription className="text-pretty">
              This batch estimate will be set aside (kept on record) and returned to staff.
              Individual line quotes stay unchanged unless staff updates them—you are asking
              for a fresh batch bundled price when they save again. Withdrawn, rejected, or
              cart-accepted lines are removed from this bundle automatically so staff only see
              the remaining quoted storefront lines.
            </DialogDescription>
          </DialogHeader>
          <p className={cn(dashItemsTableStatusPanel, "font-mono text-xs text-muted-foreground")}>
            Batch <span className="text-foreground">{batchNumber}</span>
          </p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="sm:min-w-0"
              disabled={revisionPending}
              onClick={cancelRevisionConfirm}
            >
              Keep this estimate
            </Button>
            <Button type="button" className="sm:min-w-[11rem]" onClick={confirmRevision} disabled={revisionPending}>
              {revisionPending ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Yes, send request"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
