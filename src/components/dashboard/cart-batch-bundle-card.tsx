"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Layers, Loader2, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeBatchFromCartAction } from "@/actions/remove-batch-from-cart";
import {
  CartLinePriceBreakdown,
  type CartLinePriceRow,
} from "@/components/dashboard/cart-line-price-breakdown";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CartLineUrlOrReceipt } from "@/components/dashboard/cart-line-url-or-receipt";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export type CartBatchBundleLineUi = {
  itemRequestId: string;
  productName: string | null;
  productUrl: string;
  quantity: number;
  productSize: string | null;
  productColor: string | null;
  displayProductImageUrl: string | null;
  outsidePurchaseReceiptImageUrl?: string | null;
};

export type CartBatchBundleCardProps = {
  batchSessionId: string;
  batchNumber: string;
  siteKey: string;
  siteMerchandiseCents: number;
  serviceHandlingCents: number;
  siteShippingCents: number;
  siteSaleTaxCents: number;
  customerSubtotalCents: number;
  lines: CartBatchBundleLineUi[];
};

export function CartBatchBundleCard(props: CartBatchBundleCardProps) {
  const router = useRouter();
  const [linesOpen, setLinesOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const priceRows: CartLinePriceRow[] = [
    { label: "Site merchandise", amountCents: props.siteMerchandiseCents },
    { label: "Service & handling", amountCents: props.serviceHandlingCents },
    { label: "Site shipping", amountCents: props.siteShippingCents },
    { label: "Site sale tax", amountCents: props.siteSaleTaxCents },
    {
      label: "Batch subtotal",
      amountCents: props.customerSubtotalCents,
      emphasis: true,
    },
  ];

  const runRemove = useCallback(
    (disposition: "withdraw_forever" | "return_to_batch_quotes") => {
      startTransition(async () => {
        const res = await removeBatchFromCartAction({
          batchSessionId: props.batchSessionId,
          disposition,
        });
        setRemoveOpen(false);
        if (res.ok) {
          toast.success(res.message ?? "Updated.");
          router.refresh();
        } else {
          toast.error(res.message ?? "Could not update batch.");
        }
      });
    },
    [props.batchSessionId, router],
  );

  return (
    <li className="p-4 sm:p-5">
      <article className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <header className="border-b border-border/60 bg-secondary px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Layers className="size-3 opacity-80" aria-hidden />
                  Batch bundle
                </span>
                <span className="font-mono text-sm font-semibold tracking-tight text-primary">
                  {props.batchNumber}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{props.siteKey}</span>
                <span className="mx-1.5 text-border">·</span>
                {props.lines.length}{" "}
                {props.lines.length === 1 ? "product" : "products"}
                <span className="mx-1.5 text-border">·</span>
                Combined staff estimate
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Batch total
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatUsd(props.customerSubtotalCents)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-border/70 bg-background text-xs"
                  aria-expanded={linesOpen}
                  onClick={() => setLinesOpen((o) => !o)}
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 transition-transform duration-200",
                      linesOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                  {linesOpen ? "Hide products" : "View products"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending}
                  onClick={() => setRemoveOpen(true)}
                >
                  {pending ?
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  : <Trash2 className="size-3.5" aria-hidden />}
                  Remove
                </Button>
              </div>
            </div>
            </div>
        </header>

        <div className="px-4 py-4 sm:px-5">
          <CollapsibleFieldSection
            compact
            title="Price breakdown"
            description="Site merchandise, fees, and batch subtotal"
            defaultOpen={false}
            className="border-border/70 bg-card"
          >
            <CartLinePriceBreakdown rows={priceRows} className="border-0 bg-transparent" />
          </CollapsibleFieldSection>
        </div>

        <div
          className={cn(
            "border-t border-border/60 bg-muted",
            !linesOpen && "hidden",
          )}
          role="region"
          aria-label="Products in this batch"
        >
          <div className="px-4 py-3 sm:px-5">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Included products
            </p>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70 bg-background" role="list">
              {props.lines.map((row) => {
                const qtyColorSize = [
                  `Qty ${row.quantity}`,
                  row.productSize?.trim() ? `Size ${row.productSize.trim()}` : "",
                  row.productColor?.trim() ? `Color ${row.productColor.trim()}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={row.itemRequestId}
                    className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start"
                  >
                    <ProductRequestThumbnail
                      variant="cart"
                      imageUrl={row.displayProductImageUrl}
                      productLabel={row.productName}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {row.productName?.trim() || "Unnamed product"}
                      </p>
                      <CartLineUrlOrReceipt
                        lineId={row.itemRequestId}
                        productUrl={row.productUrl}
                        outsidePurchaseReceiptImageUrl={row.outsidePurchaseReceiptImageUrl}
                      />
                      <p className="text-xs text-muted-foreground">{qtyColorSize}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Individual line prices are bundled into the batch total above. Checkout
              charges this subtotal together with any other accepted items.
            </p>
          </div>
        </div>
      </article>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this batch?</DialogTitle>
            <DialogDescription>
              Choose whether to drop these product requests permanently or send them back
              to your quoted batch so you can accept the estimate again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => runRemove("withdraw_forever")}
            >
              Delete permanently (withdraw requests)
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => runRemove("return_to_batch_quotes")}
            >
              Move back to batch quotes (quoted)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
