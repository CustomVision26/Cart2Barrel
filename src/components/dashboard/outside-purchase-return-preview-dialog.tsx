"use client";

import { useState, useTransition } from "react";
import { ClockIcon, Loader2Icon, ReceiptIcon } from "lucide-react";
import { toast } from "sonner";

import { acceptOutsidePurchaseReturnEstimateAction } from "@/actions/accept-outside-purchase-return-estimate";
import { Button, buttonVariants } from "@/components/ui/button";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ItemRequest, OutsidePurchaseReturnRequest } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  OUTSIDE_PURCHASE_RETURN_ESTIMATE_PENDING_NOTE,
  OUTSIDE_PURCHASE_RETURN_POLICY_NOTES,
  outsidePurchaseReturnPreviewTitle,
} from "@/lib/outside-purchase-return-preview-copy";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";

type OutsidePurchaseReturnPreviewDialogProps = {
  request: ItemRequest;
  returnRequest: OutsidePurchaseReturnRequest | null;
};

function parseCondition(raw: string | null): WarehouseReceiveCondition | null {
  const v = raw?.trim();
  if (
    v === "good" ||
    v === "damaged" ||
    v === "missing" ||
    v === "wrong_item"
  ) {
    return v;
  }
  return null;
}

export function OutsidePurchaseReturnPreviewDialog({
  request,
  returnRequest,
}: OutsidePurchaseReturnPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [accepting, startAccept] = useTransition();
  const condition = parseCondition(request.outsidePurchaseReceivedCondition);
  const canAccept = returnRequest?.status === "estimate_ready";
  const feePublished = returnRequest?.returnServiceFeeCents != null;

  const onAccept = () => {
    startAccept(async () => {
      const res = await acceptOutsidePurchaseReturnEstimateAction({
        itemRequestId: request.id,
        acknowledgeReturnCharges: true,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
      >
        Preview return
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,40rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle>{outsidePurchaseReturnPreviewTitle(condition)}</DialogTitle>
          <DialogDescription>
            Review return charges and policies before accepting or paying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div
            className={cn(
              "flex gap-3 rounded-lg border p-4",
              feePublished ?
                "border-primary/25 bg-primary/5"
              : "border-amber-500/30 bg-amber-500/10",
            )}
          >
            {feePublished ?
              <ReceiptIcon
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
            : <ClockIcon
                className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {feePublished ? "Return estimate" : "Estimate pending"}
              </p>
              {feePublished ?
                <p className="text-sm text-muted-foreground">
                  Return service &amp; handling:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatUsd(returnRequest!.returnServiceFeeCents!)}
                  </span>
                </p>
              : <p className="text-sm leading-snug text-muted-foreground">
                  {OUTSIDE_PURCHASE_RETURN_ESTIMATE_PENDING_NOTE}
                </p>}
            </div>
          </div>

          {returnRequest?.returnStaffNote?.trim() ?
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Staff note
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                {returnRequest.returnStaffNote.trim()}
              </p>
            </div>
          : null}

          <CollapsibleFieldSection
            title="Return policies"
            description="Fees, timelines, and discard rules before you accept"
            defaultOpen={!feePublished}
          >
            <ol className="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {OUTSIDE_PURCHASE_RETURN_POLICY_NOTES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </CollapsibleFieldSection>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-muted/15 px-6 py-4 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          {canAccept ?
            <Button type="button" disabled={accepting} onClick={onAccept}>
              {accepting ?
                <Loader2Icon className="size-4 animate-spin" />
              : "Accept return estimate"}
            </Button>
          : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


