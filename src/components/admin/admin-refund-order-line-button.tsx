"use client";

import { useCallback, useState, useTransition } from "react";

import { refundOrderLineAction } from "@/actions/refund-order-line";
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

export function AdminRefundOrderLineButton({
  orderItemId,
  linePriceCents,
  refundedCents,
  productLabel,
}: {
  orderItemId: string;
  linePriceCents: number;
  refundedCents: number;
  productLabel: string;
}) {
  const refundableCents = Math.max(0, linePriceCents - refundedCents);
  const [open, setOpen] = useState(false);
  const [amountStr, setAmountStr] = useState(String(refundableCents));
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setAmountStr(String(refundableCents));
      setReason("");
      setFeedback(null);
    }
  };

  const submit = useCallback(() => {
    const parsed = Number.parseInt(amountStr.replace(/[, _]/g, "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setFeedback("Enter a whole number of cents (USD).");
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await refundOrderLineAction({
        orderItemId,
        amountCents: parsed,
        reason: reason.trim() || undefined,
      });
      setFeedback(res.message);
      if (res.ok) {
        setOpen(false);
      }
    });
  }, [amountStr, orderItemId, reason]);

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
        Refund line
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund order line</DialogTitle>
            <DialogDescription>
              Issue a Stripe refund for{" "}
              <span className="font-medium text-foreground">
                {productLabel.trim() || "this item"}
              </span>
              . The amount is capped by what is left on this line (
              {formatUsd(refundableCents)}) and what remains on the original charge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="refund-cents">Amount (USD cents)</Label>
              <Input
                id="refund-cents"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Full line remainder: {refundableCents}¢ ({formatUsd(refundableCents)}
                ). Enter a smaller amount for a prorated refund.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">Reason (optional, internal)</Label>
              <Input
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                placeholder="e.g. customer request, out of stock"
              />
            </div>

            {feedback ? (
              <p className="text-sm text-muted-foreground">{feedback}</p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Processing…" : "Submit refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
