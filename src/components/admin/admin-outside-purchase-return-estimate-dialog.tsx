"use client";

import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { publishAdminOutsidePurchaseReturnEstimateAction } from "@/actions/admin-outside-purchase-return-estimate";
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
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ItemQuote, ItemRequest, OutsidePurchaseReturnRequest } from "@/db/schema";
import { formatUsd, type MerchantServiceTierRow } from "@/lib/admin-markup";
import {
  computeOutsidePurchaseCustomerQuoteCents,
  parseListedUnitPriceCentsFromOutsidePurchaseStaffNote,
  parseOutsidePurchaseUnitsPerPackFromStaffNote,
} from "@/lib/outside-purchase-service-quote";
import { outsidePurchaseConditionSummary } from "@/lib/outside-purchase-display";
import { outsidePurchaseReferenceDisplay } from "@/lib/outside-purchase";
import { OUTSIDE_PURCHASE_RETURN_ESTIMATE_DEFAULT_STAFF_NOTE } from "@/lib/outside-purchase-return-preview-copy";

function parseDollarsToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

type AdminOutsidePurchaseReturnEstimateDialogProps = {
  request: ItemRequest;
  quote: ItemQuote | null;
  returnRequest: OutsidePurchaseReturnRequest;
  serviceTiers: MerchantServiceTierRow[];
};

export function AdminOutsidePurchaseReturnEstimateDialog({
  request,
  quote,
  returnRequest,
  serviceTiers,
}: AdminOutsidePurchaseReturnEstimateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [transitFeeDollars, setTransitFeeDollars] = useState("");
  const [returnStaffNote, setReturnStaffNote] = useState(
    () =>
      returnRequest.returnStaffNote?.trim() ||
      OUTSIDE_PURCHASE_RETURN_ESTIMATE_DEFAULT_STAFF_NOTE,
  );
  const [publishing, startPublish] = useTransition();

  const basePricing = useMemo(() => {
    const unitPriceCents =
      parseListedUnitPriceCentsFromOutsidePurchaseStaffNote(quote?.staffNote) ?? 0;
    const unitsPerPack =
      parseOutsidePurchaseUnitsPerPackFromStaffNote(quote?.staffNote) ?? 1;
    return computeOutsidePurchaseCustomerQuoteCents({
      unitPriceCents,
      quantity: request.quantity,
      unitsPerPack,
      serviceTiers,
    });
  }, [quote?.staffNote, request.quantity, serviceTiers]);

  const transitFeeCents = parseDollarsToCents(transitFeeDollars);
  const totalFeeCents = basePricing.serviceFeeCents + transitFeeCents;

  const onPublish = () => {
    startPublish(async () => {
      const res = await publishAdminOutsidePurchaseReturnEstimateAction({
        itemRequestId: request.id,
        returnServiceFeeCents: totalFeeCents,
        returnTransitFeeCents: transitFeeCents,
        returnStaffNote: returnStaffNote.trim() || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  if (returnRequest.status !== "submitted") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "whitespace-nowrap")}
      >
        Generate estimate
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,44rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Generate return estimate</DialogTitle>
          <DialogDescription>
            Publish return service &amp; handling plus transit for the customer to preview and
            accept.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <p className="font-medium text-foreground">
              {request.productName?.trim() || "Outside purchase"}
            </p>
            <p className="mt-1 text-muted-foreground">
              Ref {outsidePurchaseReferenceDisplay(request) ?? "—"}
            </p>
            <p className="mt-1 text-muted-foreground">
              Qty {request.quantity}
              {request.productSize?.trim() ? ` · Size ${request.productSize.trim()}` : ""}
              {request.productColor?.trim() ? ` · Color ${request.productColor.trim()}` : ""}
            </p>
            {outsidePurchaseConditionSummary(request) ?
              <p className="mt-1 text-muted-foreground">
                Condition: {outsidePurchaseConditionSummary(request)}
              </p>
            : null}
            {returnRequest.customerNotes?.trim() ?
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                Customer note: {returnRequest.customerNotes.trim()}
              </p>
            : null}
          </div>

          <Field>
            <FieldLabel>Service &amp; handling (base)</FieldLabel>
            <FieldContent>
              <p className="text-sm font-medium tabular-nums text-foreground">
                {formatUsd(basePricing.serviceFeeCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                Tiered fee from listed unit price and received quantity.
              </p>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Transit fee (USD)</FieldLabel>
            <FieldContent>
              <Input
                inputMode="decimal"
                value={transitFeeDollars}
                onChange={(e) => setTransitFeeDollars(e.target.value)}
                placeholder="0.00"
              />
            </FieldContent>
          </Field>

          <p className="text-sm font-medium text-foreground">
            Total due:{" "}
            <span className="tabular-nums">{formatUsd(totalFeeCents)}</span>
          </p>

          <Field>
            <FieldLabel>Staff note (optional)</FieldLabel>
            <FieldContent>
              <textarea
                rows={2}
                value={returnStaffNote}
                onChange={(e) => setReturnStaffNote(e.target.value)}
                placeholder="Shown in the customer’s Preview return dialog…"
                className="border-input bg-transparent flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </FieldContent>
          </Field>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-muted/15 px-6 py-4 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button type="button" disabled={publishing} onClick={onPublish}>
            {publishing ?
              <Loader2Icon className="size-4 animate-spin" />
            : "Publish estimate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
