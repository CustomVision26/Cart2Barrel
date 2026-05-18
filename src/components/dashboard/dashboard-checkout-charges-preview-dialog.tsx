"use client";

import { EyeIcon, Loader2Icon } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

import {
  getDashboardCheckoutChargePreviewAction,
  type DashboardCheckoutChargePreviewInput,
} from "@/actions/dashboard-checkout-charge-preview";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/admin-markup";
import type { CheckoutChargesPreview } from "@/data/dashboard-checkout-charge-preview";

type DashboardCheckoutChargesPreviewDialogProps =
  DashboardCheckoutChargePreviewInput & {
    triggerLabel?: string;
    triggerClassName?: string;
  };

export function DashboardCheckoutChargesPreviewDialog({
  triggerLabel = "Preview checkout charges",
  triggerClassName,
  ...input
}: DashboardCheckoutChargesPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CheckoutChargesPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadPreview = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await getDashboardCheckoutChargePreviewAction(input);
      if (!res.ok) {
        setPreview(null);
        setError(res.message);
        return;
      }
      setPreview(res.preview);
    });
  }, [
    input.scope,
    input.orderId,
    input.scope === "batch" ? input.batchSessionId : "",
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          loadPreview();
        } else {
          setPreview(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        type="button"
        className={
          triggerClassName ??
          "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
      >
        <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{preview?.title ?? "Checkout charges"}</DialogTitle>
          <DialogDescription>
            {preview?.description ??
              "Summary of what was charged when you completed checkout."}
          </DialogDescription>
        </DialogHeader>

        {pending ?
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Loading checkout summary…
          </div>
        : error ?
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
            {error}
          </p>
        : preview ?
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Charge breakdown
              </p>
              <CartLinePriceBreakdown rows={preview.summaryRows} />
            </div>

            {preview.productLines.length > 0 ?
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Products on this receipt
                </p>
                <ul
                  className="divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/10"
                  role="list"
                >
                  {preview.productLines.map((line, i) => (
                    <li
                      key={`${line.name}-${i}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">{line.name}</span>
                        {line.detail ?
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {line.detail}
                          </span>
                        : null}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground">
                        {formatUsd(line.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            : null}
          </div>
        : null}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
