"use client";

import type { ItemQuote, ItemRequest } from "@/db/schema";
import { quoteRevisionLabel } from "@/lib/admin-quote-history-revision-label";

import { SingleEstimatePreviewDialog } from "@/components/orders/single-estimate-preview-dialog";

type AdminSavedQuotePreviewDialogProps = {
  quote: ItemQuote;
  request: Pick<
    ItemRequest,
    "productName" | "quantity" | "productSize" | "productColor" | "productImageUrl"
  >;
  label?: string;
};

export function AdminSavedQuotePreviewDialog({
  quote,
  request,
  label = "Preview",
}: AdminSavedQuotePreviewDialogProps) {
  return (
    <SingleEstimatePreviewDialog
      quote={quote}
      request={request}
      label={label}
      dialogTitle="Saved record"
      dialogDescription={`Product details and charges as recorded on this estimate (${quoteRevisionLabel(quote)}).`}
      staffNotesTitle="Notes from Cart2Barrel"
    />
  );
}
