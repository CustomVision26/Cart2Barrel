"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { approveOrderContainerLineRefundAction } from "@/actions/approve-order-container-refund-request";
import { rejectOrderContainerLineRefundAction } from "@/actions/reject-order-container-refund-request";
import { refundRequestReasonKindBriefLabel } from "@/components/admin/admin-refund-request-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContainerLineRefundState } from "@/data/container-line-refund-state";
import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import { formatUsd } from "@/lib/admin-markup";

export function AdminContainerChargeRefundControls({
  line,
  state,
}: {
  line: OrderContainerLineAdmin;
  state: ContainerLineRefundState | undefined;
}) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [approvePending, startApprove] = useTransition();
  const [rejectPending, startReject] = useTransition();

  const containerPending = state?.container.pending ?? null;
  const packingPending = state?.packingFee.pending ?? null;
  const pendingRequests = [containerPending, packingPending].filter(
    (r): r is NonNullable<typeof r> => r != null,
  );

  const containerAmount = containerPending
    ? (state?.container.remainderCents ?? 0)
    : 0;
  const packingAmount = packingPending
    ? (state?.packingFee.remainderCents ?? 0)
    : 0;
  const totalAmount = containerAmount + packingAmount;
  const reasonKind =
    containerPending?.reasonKind ?? packingPending?.reasonKind ?? null;
  const details = containerPending?.details ?? packingPending?.details ?? "";

  const submitApprove = useCallback(() => {
    startApprove(async () => {
      const res = await approveOrderContainerLineRefundAction({
        orderContainerItemId: line.id,
      });
      if (res.ok) {
        toast.success(res.message);
        setApproveOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [line.id, router]);

  const submitReject = useCallback(() => {
    const note = rejectNote.trim();
    if (note.length < 10) {
      toast.error("Rejection note should be at least 10 characters.");
      return;
    }
    startReject(async () => {
      const res = await rejectOrderContainerLineRefundAction({
        orderContainerItemId: line.id,
        rejectionNote: note,
      });
      if (res.ok) {
        toast.success(res.message);
        setRejectOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [line.id, rejectNote, router]);

  if (pendingRequests.length === 0) {
    const refunded =
      (state?.container.refundedCents ?? 0) +
      (state?.packingFee.refundedCents ?? 0);
    if (refunded > 0) {
      return (
        <p className="text-[10px] text-muted-foreground">
          Refunded {formatUsd(refunded)}
        </p>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
        Shopper refund request
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {containerPending ?
          <li className="flex items-center justify-between gap-3">
            <span>Container</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatUsd(containerAmount)}
            </span>
          </li>
        : null}
        {packingPending ?
          <li className="flex items-center justify-between gap-3">
            <span>Packing fee</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatUsd(packingAmount)}
            </span>
          </li>
        : null}
        <li className="flex items-center justify-between gap-3 border-t border-border/50 pt-1">
          <span className="font-medium text-foreground">Total</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatUsd(totalAmount)}
          </span>
        </li>
      </ul>
      {reasonKind ?
        <p className="text-xs leading-snug text-muted-foreground">
          {refundRequestReasonKindBriefLabel(reasonKind)}
          {" · "}Full remainder on this order
        </p>
      : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setApproveOpen(true)}
        >
          Approve refund
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => {
            setRejectOpen(true);
            setRejectNote("");
          }}
        >
          Decline
        </Button>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve container refund</DialogTitle>
            <DialogDescription>
              Issue one Stripe credit for this order covering the container
              {packingPending ? " and packing fee" : ""} ({formatUsd(totalAmount)}
              ).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted p-3 text-xs">
              <p className="font-medium text-foreground">{line.nameSnapshot}</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {containerPending ?
                  <li className="flex justify-between gap-3">
                    <span>Container</span>
                    <span className="tabular-nums text-foreground">
                      {formatUsd(containerAmount)}
                    </span>
                  </li>
                : null}
                {packingPending ?
                  <li className="flex justify-between gap-3">
                    <span>Packing fee</span>
                    <span className="tabular-nums text-foreground">
                      {formatUsd(packingAmount)}
                    </span>
                  </li>
                : null}
              </ul>
            </div>
            {details ?
              <div className="rounded-md border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Shopper details</span>
                <p className="mt-2 whitespace-pre-wrap">{details}</p>
              </div>
            : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={approvePending}
              onClick={() => setApproveOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={approvePending} onClick={submitApprove}>
              {approvePending ? "Processing…" : "Issue Stripe refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline refund request</DialogTitle>
            <DialogDescription>
              This declines the container
              {packingPending ? " and packing fee" : ""} request on this order.
            </DialogDescription>
          </DialogHeader>
          <textarea
            rows={5}
            disabled={rejectPending}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={rejectPending}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectPending}
              onClick={submitReject}
            >
              {rejectPending ? "Saving…" : "Decline request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
