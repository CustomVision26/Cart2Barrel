"use client";

import { EyeIcon } from "lucide-react";

import { AdminStaffNotesBlock } from "@/components/admin-staff-notes-block";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ItemQuote, ItemRequest } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { quoteRevisionLabel } from "@/lib/admin-quote-history-revision-label";

type AdminSavedQuotePreviewDialogProps = {
  quote: ItemQuote;
  request: Pick<
    ItemRequest,
    "productName" | "quantity" | "productSize" | "productColor" | "productImageUrl"
  >;
  label?: string;
};

function quotedLineFromQuote(quote: ItemQuote) {
  return {
    quantity: quote.requestQuantity ?? 0,
    productSize: quote.requestProductSize,
    productColor: quote.requestProductColor,
    productName: quote.requestProductName,
  };
}

function implicitTaxCents(quote: ItemQuote): number {
  const remainder =
    quote.totalPrice -
    quote.itemCost -
    quote.serviceFee -
    quote.estimatedShipping -
    (quote.packingFeeCents ?? 0);
  return Math.max(0, remainder);
}

export function AdminSavedQuotePreviewDialog({
  quote,
  request,
  label = "Preview",
}: AdminSavedQuotePreviewDialogProps) {
  const quotedLine = quotedLineFromQuote(quote);
  const productName =
    quotedLine.productName?.trim() || request.productName?.trim() || null;
  const quantity = quotedLine.quantity > 0 ? quotedLine.quantity : request.quantity;
  const taxCents = implicitTaxCents(quote);

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent"
      >
        <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,42rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saved record</DialogTitle>
          <DialogDescription>
            Product details and charges as recorded on this estimate ({quoteRevisionLabel(quote)}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2 rounded-lg border border-border bg-muted px-3 py-2.5">
            <div className="flex gap-3">
              <ProductRequestThumbnail
                variant="dialog"
                imageUrl={request.productImageUrl}
                productLabel={productName}
              />
              <div className="min-w-0 flex-1 space-y-2">
                {productName ?
                  <p className="font-medium leading-snug text-foreground">{productName}</p>
                : null}
                <dl className="space-y-1 text-xs text-muted-foreground sm:text-sm">
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                    <dt>Quantity</dt>
                    <dd className="tabular-nums text-foreground">{quantity}</dd>
                  </div>
                  {(quotedLine.productSize ?? request.productSize) ?
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                      <dt>Size</dt>
                      <dd className="text-foreground">
                        {quotedLine.productSize ?? request.productSize}
                      </dd>
                    </div>
                  : null}
                  {(quotedLine.productColor ?? request.productColor) ?
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                      <dt>Color</dt>
                      <dd className="text-foreground">
                        {quotedLine.productColor ?? request.productColor}
                      </dd>
                    </div>
                  : null}
                </dl>
              </div>
            </div>
          </div>

          <Separator />

          <ul className="space-y-2 tabular-nums">
            <li className="flex justify-between gap-3 text-muted-foreground">
              <span>Merchandise</span>
              <span className="text-foreground">{formatUsd(quote.itemCost)}</span>
            </li>
            {quote.merchandiseSavingsCents != null && quote.merchandiseSavingsCents > 0 ?
              <li className="flex justify-between gap-3 text-muted-foreground">
                <span>Merchandise savings</span>
                <span className="text-foreground">
                  −{formatUsd(quote.merchandiseSavingsCents)}
                </span>
              </li>
            : null}
            <li className="flex justify-between gap-3 text-muted-foreground">
              <span>Service &amp; handling</span>
              <span className="text-foreground">{formatUsd(quote.serviceFee)}</span>
            </li>
            {(quote.packingFeeCents ?? 0) > 0 ?
              <li className="flex justify-between gap-3 text-muted-foreground">
                <span>Packing</span>
                <span className="text-foreground">{formatUsd(quote.packingFeeCents)}</span>
              </li>
            : null}
            <li className="flex justify-between gap-3 text-muted-foreground">
              <span>Shipping (est.)</span>
              <span className="text-foreground">{formatUsd(quote.estimatedShipping)}</span>
            </li>
            <li className="flex justify-between gap-3 text-muted-foreground">
              <span>Tax</span>
              <span className="text-foreground">{formatUsd(taxCents)}</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatUsd(quote.totalPrice)}</span>
            </li>
          </ul>

          <p className="text-xs text-muted-foreground">
            Quoted {new Date(quote.createdAt).toLocaleString()}. Tax is the remainder of total
            minus line items (as saved).
          </p>

          {quote.staffNote?.trim() ?
            <AdminStaffNotesBlock staffNote={quote.staffNote} />
          : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
