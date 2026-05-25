"use client";

import { Tag } from "lucide-react";

import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import { CartRemoveButton } from "@/components/dashboard/cart-remove-button";
import { CartLineUrlOrReceipt } from "@/components/dashboard/cart-line-url-or-receipt";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { formatUsd } from "@/lib/admin-markup";
import { isOutsidePurchaseProductUrl } from "@/lib/outside-purchase";
import { outsidePurchaseQuoteSummaryRows } from "@/lib/outside-purchase-service-quote";
import { StaffNotesList } from "@/components/admin-staff-notes-block";
import { formatStaffNoteItemsForDisplay } from "@/lib/staff-note-display";

export type CartQuoteLineItemProps = {
  itemRequestId: string;
  productName: string | null;
  productUrl: string;
  quantity: number;
  productSize: string | null;
  productColor: string | null;
  displayProductImageUrl: string | null;
  itemCostCents: number;
  serviceFeeCents: number;
  estimatedShippingCents: number;
  taxCents: number;
  lineTotalCents: number;
  staffNote?: string | null;
  outsidePurchaseReceiptImageUrl?: string | null;
};

export function CartQuoteLineItem({
  itemRequestId,
  productName,
  productUrl,
  quantity,
  productSize,
  productColor,
  displayProductImageUrl,
  itemCostCents,
  serviceFeeCents,
  estimatedShippingCents,
  taxCents,
  lineTotalCents,
  staffNote,
  outsidePurchaseReceiptImageUrl,
}: CartQuoteLineItemProps) {
  const outsidePurchase = isOutsidePurchaseProductUrl(productUrl);
  const meta = [
    quantity > 1 ? `Qty ${quantity}` : null,
    productSize?.trim() ? `Size ${productSize.trim()}` : null,
    productColor?.trim() ? `Color ${productColor.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const priceRows = outsidePurchase
    ? outsidePurchaseQuoteSummaryRows({
        serviceFee: serviceFeeCents,
        requestQuantity: quantity,
        totalPrice: lineTotalCents,
        staffNote: staffNote ?? null,
      })
    : [
        { label: "Item cost", amountCents: itemCostCents },
        { label: "Service & handling", amountCents: serviceFeeCents },
        { label: "Est. shipping", amountCents: estimatedShippingCents },
        { label: "Tax", amountCents: taxCents },
        { label: "Line estimate", amountCents: lineTotalCents, emphasis: true },
      ];

  const staffNoteItems = formatStaffNoteItemsForDisplay(staffNote);

  return (
    <li className="p-4 sm:p-5">
      <article className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ProductRequestThumbnail
          variant="cart"
          imageUrl={displayProductImageUrl}
          productLabel={productName}
          className="ring-1 ring-border/40"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <Tag className="size-3 opacity-70" aria-hidden />
                {outsidePurchase ? "Outside purchase" : "Quoted item"}
              </span>
              <h3 className="text-base font-semibold leading-snug text-foreground">
                {productName?.trim() || "Unnamed product"}
              </h3>
              {meta ?
                <p className="text-xs text-muted-foreground">{meta}</p>
              : null}
              <CartLineUrlOrReceipt
                lineId={itemRequestId}
                productUrl={productUrl}
                outsidePurchaseReceiptImageUrl={outsidePurchaseReceiptImageUrl}
              />
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <p className="text-right">
                <span className="block text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatUsd(lineTotalCents)}
                </span>
                <span className="text-[11px] text-muted-foreground">estimate</span>
              </p>
              <CartRemoveButton itemRequestId={itemRequestId} />
            </div>
          </div>

          <CollapsibleFieldSection
            compact
            title={outsidePurchase ? "Outside purchase price breakdown" : "Price breakdown"}
            description={
              outsidePurchase ?
                "Outside purchase service & handling and amount due (in-app fees not included)"
              : "Item cost, fees, shipping, and tax"
            }
            defaultOpen={false}
            className="border-border/70 bg-muted"
          >
            <CartLinePriceBreakdown rows={priceRows} className="border-0 bg-transparent" />
          </CollapsibleFieldSection>

          {staffNoteItems.length > 0 ?
            <CollapsibleFieldSection
              compact
              title="Notes from Cart2Barrel"
              description="Staff notes for this estimate"
              defaultOpen={false}
              className="border-border/70 bg-muted"
            >
              <StaffNotesList items={staffNoteItems} compact />
            </CollapsibleFieldSection>
          : null}
        </div>
      </article>
    </li>
  );
}
