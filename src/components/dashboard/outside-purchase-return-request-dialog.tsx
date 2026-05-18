"use client";

import { useState, useTransition } from "react";
import { CalendarRangeIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitOutsidePurchaseReturnRequestAction } from "@/actions/submit-outside-purchase-return-request";
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
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type OutsidePurchaseReturnRequestDialogProps = {
  itemRequestId: string;
  productLabel?: string;
  /** When true, uses amber warning styling for problem-receipt lines. */
  warning?: boolean;
};

export function OutsidePurchaseReturnRequestDialog({
  itemRequestId,
  productLabel,
  warning = false,
}: OutsidePurchaseReturnRequestDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [ackPolicy, setAckPolicy] = useState(false);
  const [labelFile, setLabelFile] = useState<File | null>(null);

  const reset = () => {
    setWindowStart("");
    setWindowEnd("");
    setCustomerNotes("");
    setAckPolicy(false);
    setLabelFile(null);
  };

  const onSubmit = () => {
    if (!windowStart || !windowEnd) {
      toast.error("Enter the return window start and end.");
      return;
    }
    if (!ackPolicy) {
      toast.error("Confirm the discard policy to continue.");
      return;
    }

    const fd = new FormData();
    fd.set("itemRequestId", itemRequestId);
    fd.set("returnWindowStart", new Date(windowStart).toISOString());
    fd.set("returnWindowEnd", new Date(windowEnd).toISOString());
    if (customerNotes.trim()) fd.set("customerNotes", customerNotes.trim());
    fd.set("acknowledgeDiscardPolicy", "true");
    if (labelFile) fd.set("returnLabelImage", labelFile);

    startTransition(async () => {
      const res = await submitOutsidePurchaseReturnRequestAction(fd);
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: warning ? "outline" : "secondary", size: "sm" }),
          "w-full",
          warning &&
            "border-amber-600/60 bg-amber-500/15 font-medium text-amber-950 hover:bg-amber-500/25 dark:border-amber-500/55 dark:bg-amber-500/20 dark:text-amber-50",
        )}
      >
        Return to retailer request
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,40rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle>Return to retailer</DialogTitle>
          {productLabel ?
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>
                Request a return workflow for{" "}
                <span className="font-medium text-foreground">{productLabel}</span>
                {" · "}
                <QuoteEstimatePreviewDialog
                  itemRequestId={itemRequestId}
                  label="Preview estimate"
                  triggerVariant="link"
                />
              </p>
              <p>
                You will receive a return estimate to accept and pay before drop-off at the
                carrier.
              </p>
            </div>
          : <DialogDescription>
              Submit return details for staff review. You will receive a return estimate to
              accept and pay before drop-off at the carrier.
            </DialogDescription>
          }
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="flex gap-3 rounded-lg border border-border bg-muted/15 p-3">
            <CalendarRangeIcon
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm leading-snug text-muted-foreground">
              Enter when the retailer or marketplace allows you to ship the return.
              Staff will publish return service &amp; handling charges for you to accept.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`return-start-${itemRequestId}`}>
                Return window start
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`return-start-${itemRequestId}`}
                  type="datetime-local"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor={`return-end-${itemRequestId}`}>
                Return window end
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`return-end-${itemRequestId}`}
                  type="datetime-local"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
              </FieldContent>
            </Field>
          </div>

          <CollapsibleFieldSection
            title="Optional details"
            description="Return label image and notes for staff"
            defaultOpen={false}
          >
            <Field>
              <FieldLabel htmlFor={`return-label-${itemRequestId}`}>
                Return label / receipt copy
              </FieldLabel>
              <FieldContent>
                <FieldDescription>
                  Upload a copy the shipping company can scan to print the return label.
                </FieldDescription>
                <Input
                  id={`return-label-${itemRequestId}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="mt-1.5"
                  onChange={(e) => setLabelFile(e.target.files?.[0] ?? null)}
                />
                {labelFile ?
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Selected: {labelFile.name}
                  </p>
                : null}
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor={`return-notes-${itemRequestId}`}>
                Notes for staff
              </FieldLabel>
              <FieldContent>
                <textarea
                  id={`return-notes-${itemRequestId}`}
                  rows={3}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Retailer name, RMA number, or special instructions…"
                  className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
                />
              </FieldContent>
            </Field>
          </CollapsibleFieldSection>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
              ackPolicy ?
                "border-primary/30 bg-primary/5"
              : "border-amber-500/35 bg-amber-500/10",
            )}
          >
            <input
              type="checkbox"
              checked={ackPolicy}
              onChange={(e) => setAckPolicy(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-input"
            />
            <span className="leading-snug text-muted-foreground">
              I understand unpaid problem receipts (damaged, wrong item, missing) may be
              discarded if I do not accept and pay the return estimate in time.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-muted/15 px-6 py-4 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onSubmit}>
            {pending ?
              <Loader2Icon className="size-4 animate-spin" />
            : "Submit return request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
