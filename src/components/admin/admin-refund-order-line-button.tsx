"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { refundOrderLineAction } from "@/actions/refund-order-line";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

function parseRefundAmountCents(raw: string): number | null {
  const parsed = Number.parseInt(raw.replace(/[, _]/g, "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

export function AdminRefundOrderLineButton({
  orderItemId,
  linePriceCents,
  refundedCents,
  productLabel,
  triggerLabel = "Refund line",
}: {
  orderItemId: string;
  linePriceCents: number;
  refundedCents: number;
  productLabel: string;
  triggerLabel?: string;
}) {
  const refundableCents = Math.max(0, linePriceCents - refundedCents);
  const displayProductLabel = productLabel.trim() || "Unnamed product";
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amountStr, setAmountStr] = useState(String(refundableCents));
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const parsedAmountCents = useMemo(
    () => parseRefundAmountCents(amountStr),
    [amountStr],
  );

  const amountExceedsRemainder =
    parsedAmountCents != null && parsedAmountCents > refundableCents;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmOpen(false);
    }
    if (next) {
      setAmountStr(String(refundableCents));
      setReason("");
    }
  };

  const submitRefund = useCallback(() => {
    if (parsedAmountCents == null) {
      toast.error("Enter a whole number of cents (USD).");
      return;
    }
    if (parsedAmountCents > refundableCents) {
      toast.error(
        `Amount cannot exceed the line remainder (${formatUsd(refundableCents)}).`,
      );
      return;
    }

    startTransition(async () => {
      const res = await refundOrderLineAction({
        orderItemId,
        amountCents: parsedAmountCents,
        reason: reason.trim() || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        setConfirmOpen(false);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  }, [orderItemId, parsedAmountCents, reason, refundableCents]);

  const onReviewRefund = () => {
    if (parsedAmountCents == null) {
      toast.error("Enter a whole number of cents (USD).");
      return;
    }
    if (amountExceedsRemainder) {
      toast.error(
        `Amount cannot exceed the line remainder (${formatUsd(refundableCents)}).`,
      );
      return;
    }
    setConfirmOpen(true);
  };

  if (refundableCents <= 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => onOpenChange(true)}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="space-y-2 border-b border-border/60 px-6 py-5 text-left">
            <DialogTitle>Issue line refund</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Initiate a Stripe refund for this order line. The amount cannot exceed
              the remaining balance on this line ({formatUsd(refundableCents)}) or
              the original charge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Product
              </p>
              <p
                className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground"
                title={displayProductLabel}
              >
                {displayProductLabel}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Line remainder:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatUsd(refundableCents)}
                </span>
                {refundedCents > 0 ?
                  <>
                    {" "}
                    · previously refunded{" "}
                    <span className="tabular-nums">{formatUsd(refundedCents)}</span>
                  </>
                : null}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-cents">Refund amount (USD cents)</Label>
              <Input
                id="refund-cents"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={pending}
                className="tabular-nums"
                aria-invalid={amountExceedsRemainder}
              />
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  amountExceedsRemainder ?
                    "text-destructive"
                  : "text-muted-foreground",
                )}
              >
                Maximum refundable: {refundableCents.toLocaleString()}¢ (
                {formatUsd(refundableCents)}). Enter a lower value for a partial
                refund.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Internal reason (optional)</Label>
              <Input
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                placeholder="For example: customer request, out of stock"
              />
              <p className="text-xs text-muted-foreground">
                Stored for staff reference only. Not shown to the customer.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 px-6 py-4 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                pending || parsedAmountCents == null || amountExceedsRemainder
              }
              onClick={onReviewRefund}
            >
              Review refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stripe refund?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
              <span className="block">
                You are about to issue a refund of{" "}
                <span className="font-medium text-foreground">
                  {parsedAmountCents != null ?
                    formatUsd(parsedAmountCents)
                  : "—"}
                </span>{" "}
                for{" "}
                <span className="font-medium text-foreground">
                  {displayProductLabel}
                </span>
                . This action is processed through Stripe and cannot be undone from
                this screen.
              </span>
              {reason.trim() ?
                <span className="block">
                  Internal reason:{" "}
                  <span className="font-medium text-foreground">{reason.trim()}</span>
                </span>
              : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={<Button type="button" variant="outline" disabled={pending} />}
            >
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              render={<Button type="button" disabled={pending} />}
              onClick={(event) => {
                event.preventDefault();
                submitRefund();
              }}
            >
              {pending ?
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  Processing…
                </>
              : "Issue refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
