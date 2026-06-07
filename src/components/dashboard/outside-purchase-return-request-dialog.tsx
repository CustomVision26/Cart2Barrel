"use client";

import { useState, useTransition } from "react";
import {
  CalendarClockIcon,
  Loader2Icon,
  PackageIcon,
  TruckIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitOutsidePurchaseReturnRequestAction } from "@/actions/submit-outside-purchase-return-request";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { parseOutsidePurchaseReceivedCondition } from "@/lib/outside-purchase-display";
import {
  warehouseReceiveConditionLabel,
  type WarehouseReceiveCondition,
} from "@/lib/warehouse-receive-condition";

const FORM_TEXTAREA_CLASS = cn(
  "border-input bg-background placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30",
  "flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3",
);

const RETURN_STEPS = [
  "Submit your return window and shipping label.",
  "Review and accept the return service estimate from staff.",
  "Pay, then drop the package at your carrier during the return window.",
] as const;

type OutsidePurchaseReturnRequestDialogProps = {
  itemRequestId: string;
  productLabel?: string;
  receivedCondition?: WarehouseReceiveCondition | null;
  /** When true, uses amber warning styling for problem-receipt lines. */
  warning?: boolean;
};

export function OutsidePurchaseReturnRequestDialog({
  itemRequestId,
  productLabel,
  receivedCondition = null,
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

  const conditionLabel =
    receivedCondition ? warehouseReceiveConditionLabel(receivedCondition) : null;

  const reset = () => {
    setWindowStart("");
    setWindowEnd("");
    setCustomerNotes("");
    setAckPolicy(false);
    setLabelFile(null);
  };

  const onSubmit = () => {
    if (!windowEnd.trim()) {
      toast.error("Enter the date and time you must return the item by.");
      return;
    }
    if (!windowStart.trim()) {
      toast.error("Enter the earliest date you can ship the return.");
      return;
    }
    if (new Date(windowEnd).getTime() < new Date(windowStart).getTime()) {
      toast.error("Return-by date must be on or after the earliest ship date.");
      return;
    }
    if (!labelFile) {
      toast.error("Upload your return shipping label for the carrier.");
      return;
    }
    if (!ackPolicy) {
      toast.error("Confirm the return policy to continue.");
      return;
    }

    const fd = new FormData();
    fd.set("itemRequestId", itemRequestId);
    fd.set("returnWindowStart", new Date(windowStart).toISOString());
    fd.set("returnWindowEnd", new Date(windowEnd).toISOString());
    if (customerNotes.trim()) fd.set("customerNotes", customerNotes.trim());
    fd.set("acknowledgeDiscardPolicy", "true");
    fd.set("returnLabelImage", labelFile);

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
        Return to retailer
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-3 border-b border-border bg-muted/30 px-6 py-5">
          <div className="space-y-1">
            <DialogTitle className="text-lg tracking-tight">
              Return to retailer
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Send this outside-purchase item back to the retailer. Provide when
              you must ship the return and your carrier label so staff can prepare
              your return estimate.
            </DialogDescription>
          </div>
          {productLabel ?
            <div className="rounded-xl border border-border/80 bg-background px-3.5 py-3 ring-1 ring-foreground/5">
              <div className="flex items-start gap-3">
                <PackageIcon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {productLabel}
                  </p>
                  {conditionLabel ?
                    <p className="text-xs text-muted-foreground">
                      Received condition:{" "}
                      <span className="font-medium text-foreground">
                        {conditionLabel}
                      </span>
                    </p>
                  : null}
                </div>
              </div>
              <div className="mt-3 border-t border-border/70 pt-3">
                <QuoteEstimatePreviewDialog
                  itemRequestId={itemRequestId}
                  label="Preview service estimate"
                  triggerVariant="button"
                />
              </div>
            </div>
          : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
          <ol className="space-y-2.5 rounded-xl border border-border/80 bg-background/60 px-4 py-3.5 text-sm text-muted-foreground">
            {RETURN_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 leading-snug">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <section className="space-y-4 rounded-xl border border-border/80 bg-background/50 p-4 ring-1 ring-foreground/5">
            <div className="flex gap-3">
              <CalendarClockIcon
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Return window
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Enter the period the retailer or marketplace allows you to ship
                  this return. Staff uses these dates when publishing your return
                  service estimate.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`return-start-${itemRequestId}`}>
                  Earliest ship date
                </FieldLabel>
                <FieldContent>
                  <FieldDescription>
                    When you can first drop the package at the carrier.
                  </FieldDescription>
                  <Input
                    id={`return-start-${itemRequestId}`}
                    type="datetime-local"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="mt-1.5"
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor={`return-end-${itemRequestId}`}>
                  Return by (deadline)
                </FieldLabel>
                <FieldContent>
                  <FieldDescription>
                    Last date and time the return must be shipped.
                  </FieldDescription>
                  <Input
                    id={`return-end-${itemRequestId}`}
                    type="datetime-local"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                    className="mt-1.5"
                  />
                </FieldContent>
              </Field>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/80 bg-background/50 p-4 ring-1 ring-foreground/5">
            <div className="flex gap-3">
              <TruckIcon
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Return shipping label
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Upload the label your retailer or marketplace provided. The
                  shipping company needs a scannable copy to print the label at
                  drop-off.
                </p>
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor={`return-label-${itemRequestId}`}>
                Label image <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`return-label-${itemRequestId}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setLabelFile(e.target.files?.[0] ?? null)}
                />
                {labelFile ?
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Selected: {labelFile.name}
                  </p>
                : <p className="mt-1.5 text-xs text-muted-foreground">
                    JPEG, PNG, WebP, or GIF.
                  </p>
                }
              </FieldContent>
            </Field>
          </section>

          <Field>
            <FieldLabel htmlFor={`return-notes-${itemRequestId}`}>
              Notes for staff <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <FieldContent>
              <FieldDescription>
                RMA number, retailer name, or special drop-off instructions.
              </FieldDescription>
              <textarea
                id={`return-notes-${itemRequestId}`}
                rows={3}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Example: Walmart RMA #12345 — return window closes Friday."
                className={cn(FORM_TEXTAREA_CLASS, "mt-1.5")}
              />
            </FieldContent>
          </Field>

          <Separator className="bg-border/80" />

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors",
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
              I understand return service and handling must be paid before I can
              drop off at the carrier. Problem-receipt items that are not returned
              in time may be discarded per Cart2Barrel policy.
            </span>
          </label>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onSubmit}>
            {pending ?
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                Submitting…
              </>
            : "Submit return request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
