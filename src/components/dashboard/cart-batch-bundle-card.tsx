"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeBatchFromCartAction } from "@/actions/remove-batch-from-cart";
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
  const [linesOpen, setLinesOpen] = useState(true);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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
    <li className="border-b border-border bg-card px-4 py-4 last:border-b-0">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "mt-0.5 h-9 shrink-0 gap-2 border-border/70 px-2.5 text-muted-foreground",
                "hover:border-border hover:bg-muted/50 hover:text-foreground"
              )}
              aria-expanded={linesOpen}
              onClick={() => setLinesOpen((o) => !o)}
              aria-label={
                linesOpen ? "Hide batch line items" : "Show batch line items"
              }
            >
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200",
                  linesOpen && "rotate-180"
                )}
                aria-hidden
              />
              <span className="text-xs font-medium">
                {linesOpen ? "Hide items" : "Show items"}
              </span>
            </Button>
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-foreground">
                Batch{" "}
                <span className="font-mono text-primary">{props.batchNumber}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Site key{" "}
                <span className="font-medium text-foreground">{props.siteKey}</span>
                {" · "}
                Combined staff estimate ({props.lines.length}{" "}
                {props.lines.length === 1 ? "product" : "products"})
              </p>
              <p className="text-sm font-semibold text-foreground">
                Batch total{" "}
                <span>{formatUsd(props.customerSubtotalCents)}</span>
              </p>
              <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex justify-between gap-4 sm:block">
                  <dt>Site merchandise</dt>
                  <dd className="text-foreground sm:text-right">
                    {formatUsd(props.siteMerchandiseCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt>Service &amp; handling</dt>
                  <dd className="text-foreground sm:text-right">
                    {formatUsd(props.serviceHandlingCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt>Site shipping</dt>
                  <dd className="text-foreground sm:text-right">
                    {formatUsd(props.siteShippingCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt>Site sale tax</dt>
                  <dd className="text-foreground sm:text-right">
                    {formatUsd(props.siteSaleTaxCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block sm:col-span-2">
                  <dt>Customer subtotal</dt>
                  <dd className="font-medium text-foreground sm:text-right">
                    {formatUsd(props.customerSubtotalCents)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={pending}
              onClick={() => setRemoveOpen(true)}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  Updating…
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                  Remove batch
                </>
              )}
            </Button>
          </div>
        </div>

        <div className={cn(!linesOpen && "hidden")} role="region">
          <ul className="divide-y divide-border rounded-md border border-border">
            {props.lines.map((row) => {
              const qtyColorSize = [
                `Qty ${row.quantity}`,
                row.productSize?.trim()
                  ? `Size ${row.productSize.trim()}`
                  : "",
                row.productColor?.trim()
                  ? `Color ${row.productColor.trim()}`
                  : "",
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
                    <p className="font-medium text-foreground">
                      {row.productName?.trim() || "Unnamed product"}
                    </p>
                    <a
                      href={row.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {row.productUrl}
                    </a>
                    <p className="text-xs text-muted-foreground">{qtyColorSize}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Line prices are bundled into the batch total shown above. Checkout uses this
            subtotal plus any other accepted items.
          </p>
        </div>
      </div>

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
