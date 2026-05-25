"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { approveOrderItemRefundRequestAction } from "@/actions/approve-order-item-refund-request";
import { rejectOrderItemRefundRequestAction } from "@/actions/reject-order-item-refund-request";
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
import type { PendingRefundRequestBrief } from "@/data/order-item-refund-requests";
import { formatUsd } from "@/lib/admin-markup";
import { refundableLineRemainderCents } from "@/lib/order-line-refund-eligibility";

function maxApprovedCentsForRequest(
  linePriceCents: number,
  refundedCents: number,
  request: PendingRefundRequestBrief,
): number {
  const remainder = refundableLineRemainderCents(linePriceCents, refundedCents);
  const capFromCustomer =
    request.requestedAmountCents == null ?
      remainder
    : Math.min(request.requestedAmountCents, remainder);
  return Math.min(remainder, capFromCustomer);
}

export function refundRequestReasonKindBriefLabel(
  kind: PendingRefundRequestBrief["reasonKind"],
): string {
  switch (kind) {
    case "defective_or_damaged":
      return "Defective / damaged";
    case "wrong_item":
      return "Wrong item";
    case "not_received":
      return "Not received";
    case "not_as_described":
      return "Not as described";
    case "duplicate_charge":
      return "Duplicate charge";
    case "changed_mind":
      return "Changed mind";
    case "other":
      return "Other";
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}

export function AdminRefundRequestControls({
  refundRequest,
  linePriceCents,
  refundedCents,
  productLabel,
  productNumber,
  orderNumber,
  batchNumber,
  batchSessionId,
}: {
  refundRequest: PendingRefundRequestBrief;
  linePriceCents: number;
  refundedCents: number;
  productLabel: string;
  productNumber: string;
  orderNumber?: string | null;
  batchNumber?: string | null;
  batchSessionId?: string | null;
}) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveCentsStr, setApproveCentsStr] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [approvePending, startApprove] = useTransition();
  const [rejectPending, startReject] = useTransition();

  const maxApprove = maxApprovedCentsForRequest(
    linePriceCents,
    refundedCents,
    refundRequest,
  );

  const reasonLabel = refundRequestReasonKindBriefLabel(refundRequest.reasonKind);
  const batchDisplay =
    batchNumber?.trim() ? batchNumber.trim()
    : batchSessionId?.trim() ? `Session ${batchSessionId.trim().slice(0, 8)}…`
    : null;

  const onApproveOpenChange = useCallback((open: boolean) => {
    setApproveOpen(open);
    if (open) {
      setApproveCentsStr(String(Math.max(0, maxApprove)));
    }
  }, [maxApprove]);

  const submitApprove = useCallback(() => {
    const n = Number.parseInt(approveCentsStr.replace(/[, _]/g, "").trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a whole number of USD cents.");
      return;
    }
    if (n > maxApprove) {
      toast.error(`Amount exceeds the shopper cap (${maxApprove}¢).`);
      return;
    }
    startApprove(async () => {
      const res = await approveOrderItemRefundRequestAction({
        refundRequestId: refundRequest.id,
        approvedAmountCents: n,
      });
      if (res.ok) {
        toast.success(res.message);
        setApproveOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [approveCentsStr, maxApprove, refundRequest.id, router]);

  const submitReject = useCallback(() => {
    const note = rejectNote.trim();
    if (note.length < 10) {
      toast.error("Rejection note should be at least 10 characters.");
      return;
    }
    startReject(async () => {
      const res = await rejectOrderItemRefundRequestAction({
        refundRequestId: refundRequest.id,
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
  }, [rejectNote, refundRequest.id, router]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
        Shopper refund request
      </p>
      <p className="text-xs leading-snug text-muted-foreground">
        {reasonLabel}
        {" · "}
        {refundRequest.requestedAmountCents == null ?
          `Full line remainder (${formatUsd(maxApprove)} max)`
        : `Asked ≤ ${formatUsd(refundRequest.requestedAmountCents)}`}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => onApproveOpenChange(true)}
        >
          Approve refund
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="whitespace-nowrap border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => {
            setRejectOpen(true);
            setRejectNote("");
          }}
        >
          Decline
        </Button>
      </div>

      <Dialog open={approveOpen} onOpenChange={onApproveOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve shopper refund</DialogTitle>
            <DialogDescription>
              Issue Stripe credit for{" "}
              <span className="font-medium text-foreground">
                {productLabel.trim() || "this item"}
              </span>
              . Approved amount is capped at {maxApprove}¢ (
              {formatUsd(maxApprove)}
              ).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted p-3 text-xs leading-relaxed">
              <dl className="grid gap-2 text-foreground">
                <div>
                  <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                    Product name
                  </dt>
                  <dd className="mt-0.5 font-medium leading-snug">
                    {productLabel.trim() || "Item"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                    Product number
                  </dt>
                  <dd className="mt-0.5 break-all font-mono" title={productNumber}>
                    {productNumber}
                  </dd>
                </div>
                {orderNumber?.trim() ?
                  <div>
                    <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                      Order number
                    </dt>
                    <dd className="mt-0.5 break-all font-mono" title={orderNumber.trim()}>
                      {orderNumber.trim()}
                    </dd>
                  </div>
                : null}
                {batchDisplay ?
                  <div>
                    <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                      Batch
                    </dt>
                    <dd className="mt-0.5 font-medium">{batchDisplay}</dd>
                    {batchSessionId?.trim() && batchNumber?.trim() ?
                      <dd
                        className="mt-1 break-all font-mono text-[10px] text-muted-foreground"
                        title={batchSessionId.trim()}
                      >
                        ID {batchSessionId.trim()}
                      </dd>
                    : null}
                  </div>
                : null}
              </dl>
            </div>
            <div className="rounded-md border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Shopper details</span>
              <p className="mt-2 whitespace-pre-wrap">{refundRequest.details}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approve-refund-cents">Refund (USD cents)</Label>
              <Input
                id="approve-refund-cents"
                inputMode="numeric"
                disabled={approvePending}
                value={approveCentsStr}
                onChange={(e) => setApproveCentsStr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Max for this approval: {maxApprove}¢ ({formatUsd(maxApprove)}).
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
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
              Provide an internal note documenting why this request did not qualify. The shopper may
              follow up separately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reject-refund-note">Staff note</Label>
            <textarea
              id="reject-refund-note"
              rows={5}
              disabled={rejectPending}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
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
