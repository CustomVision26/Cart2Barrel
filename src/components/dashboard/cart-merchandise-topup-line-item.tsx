"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";

import { removeMerchandiseTopupFromCartAction } from "@/actions/user-merchandise-topup-cart";
import { AbsoluteExpiryCountdownLabel } from "@/components/dashboard/absolute-expiry-countdown-label";
import { MerchandiseTopupChargePreviewDialog } from "@/components/dashboard/merchandise-topup-charge-preview-dialog";
import { Button } from "@/components/ui/button";
import type { MerchandiseTopupCartLineView } from "@/data/merchandise-topup-cart";
import { formatUsd } from "@/lib/admin-markup";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { cn } from "@/lib/utils";

type CartMerchandiseTopupLineItemProps = {
  line: MerchandiseTopupCartLineView;
};

export function CartMerchandiseTopupLineItem({
  line,
}: CartMerchandiseTopupLineItemProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await removeMerchandiseTopupFromCartAction({
        reconciliationId: line.reconciliationId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex gap-3 sm:gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted text-primary">
          <CreditCard className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 space-y-1">
              <p className="font-medium leading-snug text-foreground">
                {line.productName}
              </p>
              <p className="text-xs text-muted-foreground">
                Purchase-price top-up
                {line.siteLabel ? ` · ${line.siteLabel}` : null}
                {" · "}Qty {line.quantity}
              </p>
            </div>
            <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
              {formatUsd(line.amountCents)}
            </p>
          </div>

          <dl className="grid gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-xs sm:grid-cols-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <dt className="text-muted-foreground">Top-up #</dt>
              <dd className="font-mono font-medium tabular-nums text-foreground">
                {line.topupNumber}
              </dd>
            </div>
            {line.batchNumber ?
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <dt className="text-muted-foreground">Batch #</dt>
                <dd className="font-mono font-medium tabular-nums text-foreground">
                  {line.batchNumber}
                </dd>
              </div>
            : line.lines.length === 1 ?
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <dt className="text-muted-foreground">Product #</dt>
                <dd className="font-mono font-medium tabular-nums text-foreground">
                  {line.productNumber}
                </dd>
              </div>
            : null}
          </dl>

          {line.lines.length > 1 ?
            <ul className="space-y-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs">
              {line.lines.map((product) => (
                <li
                  key={product.orderItemId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                >
                  <span className="min-w-0 flex-1 line-clamp-2 text-foreground">
                    {product.productName}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    Product #:{" "}
                    <span className="text-foreground">{product.productNumber}</span>
                    {" · "}Qty {product.quantity}
                  </span>
                </li>
              ))}
            </ul>
          : null}

          <div className="flex flex-wrap items-end justify-between gap-3">
            {line.expiresAt ?
              <AbsoluteExpiryCountdownLabel
                expiresAt={line.expiresAt}
                onExpired={() => router.refresh()}
              />
            : <span />}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[7.5rem]">
                <MerchandiseTopupChargePreviewDialog
                  charge={line}
                  label="Preview"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
                )}
                disabled={pending}
                onClick={remove}
              >
                Remove
              </Button>
              <Link
                href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                View in Products
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
