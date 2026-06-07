"use client";

import { EyeIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type ProductChargesPreviewDialogProps = {
  productLabel: string;
  merchandise: number;
  serviceFee: number;
  shipping: number;
  tax: number;
  total: number;
  note?: string | null;
  isOutsidePurchase?: boolean;
};

export function ProductChargesPreviewDialog({
  productLabel,
  merchandise,
  serviceFee,
  shipping,
  tax,
  total,
  note,
  isOutsidePurchase = false,
}: ProductChargesPreviewDialogProps) {
  const rows: { label: string; value: string; emphasis?: boolean }[] =
    isOutsidePurchase ?
      [
        { label: "Service & handling", value: formatUsd(serviceFee) },
        { label: "Total", value: formatUsd(total), emphasis: true },
      ]
    : [
        { label: "Merchandise total", value: formatUsd(merchandise) },
        { label: "Service & handling", value: formatUsd(serviceFee) },
        { label: "Shipping (est.)", value: formatUsd(shipping) },
        { label: "Tax / sale tax", value: formatUsd(tax) },
        { label: "Total", value: formatUsd(total), emphasis: true },
      ];

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-7 gap-1 px-2 text-xs",
        )}
      >
        <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        Preview
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batch estimate breakdown</DialogTitle>
          <DialogDescription>
            This product&apos;s share of the batch estimate for{" "}
            {productLabel.trim() || "this product"}.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 tabular-nums text-sm text-muted-foreground">
          {rows.map((row) => (
            <li
              key={row.label}
              className={cn(
                "flex justify-between gap-3",
                row.emphasis ?
                  "border-t border-border pt-2 text-base font-semibold text-foreground"
                : null,
              )}
            >
              <span>{row.label}</span>
              <span className={row.emphasis ? undefined : "text-foreground"}>
                {row.value}
              </span>
            </li>
          ))}
        </ul>
        {isOutsidePurchase ? (
          <p className="text-xs text-muted-foreground">
            Merchandise was purchased elsewhere and is not billed here — you pay
            service &amp; handling only.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            The saved batch estimate divided across bundled products by each
            line&apos;s quoted share, so every line adds up to the batch
            subtotal.
          </p>
        )}
        {note?.trim() ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Batch estimate notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {note.trim()}
            </p>
          </div>
        ) : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
