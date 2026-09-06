"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { addMerchandiseTopupToCartAction } from "@/actions/user-merchandise-topup-cart";
import { AbsoluteExpiryCountdownLabel } from "@/components/dashboard/absolute-expiry-countdown-label";
import { MerchandiseTopupChargePreviewDialog } from "@/components/dashboard/merchandise-topup-charge-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MerchandiseTopupAddOnChargeView } from "@/data/merchandise-topup-cart";
import { formatUsd } from "@/lib/admin-markup";
import { appTableStickyActionsCell } from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

type MerchandiseTopupAddonTableRowsProps = {
  charges: MerchandiseTopupAddOnChargeView[];
};

/** Renders purchase-price top-up add-ons as rows in the Products → Active table. */
export function MerchandiseTopupAddonTableRows({
  charges,
}: MerchandiseTopupAddonTableRowsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (charges.length === 0) return null;

  function addToCart(reconciliationId: string) {
    startTransition(async () => {
      const res = await addMerchandiseTopupToCartAction({ reconciliationId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Added to cart.");
      router.refresh();
    });
  }

  return (
    <>
      {charges.map((charge) => (
        <tr
          key={`topup-${charge.reconciliationId}`}
          className="align-top bg-primary/5 transition-[background-color] duration-150"
          data-addon-charge="merchandise-topup"
        >
          <td className="px-2 py-3 text-center align-top">
            <span className="sr-only">Add-on charge (not batchable)</span>
            <span aria-hidden className="text-muted-foreground">
              —
            </span>
          </td>
          <td className="px-3 py-3 align-top">
            <ProductRequestThumbnail
              variant="list"
              imageUrl={charge.imageUrl}
              productLabel={charge.productNames[0] ?? charge.productName}
            />
          </td>
          <td
            className="px-3 py-3 align-top font-mono text-xs text-foreground"
            title={
              charge.batchNumber ?
                `Batch ${charge.batchNumber} · ${charge.lines
                  .map((l) => l.productNumber)
                  .join(", ")}`
              : charge.productNumber
            }
          >
            {charge.batchNumber ?
              <span className="block">
                <span className="text-[10px] font-sans font-medium uppercase tracking-wide text-muted-foreground">
                  Batch
                </span>
                <span className="block">{charge.batchNumber}</span>
              </span>
            : charge.productNumber}
          </td>
          <td className="px-3 py-3 align-top font-medium text-foreground">
            <span className="line-clamp-2 break-words">
              {charge.productNames.length > 1 ?
                charge.productNames.join(" · ")
              : charge.productNames[0]}
            </span>
            <span className="mt-1.5 inline-flex rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              Purchase price top-up
            </span>
            <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
              Top-up #:{" "}
              <span className="text-foreground">{charge.topupNumber}</span>
              {charge.lines.length > 1 ?
                <>
                  {" · "}
                  {charge.lines.map((l) => l.productNumber).join(" · ")}
                </>
              : null}
            </p>
          </td>
          <td className="max-w-[8rem] px-3 py-3 align-top text-muted-foreground">
            <span className="line-clamp-2 text-xs sm:text-sm">
              {charge.siteLabel ?? "—"}
            </span>
          </td>
          <td className="whitespace-nowrap px-3 py-3 align-top">
            {charge.productUrl ?
              <Link
                href={charge.productUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Product url
              </Link>
            : <span className="text-xs text-muted-foreground">—</span>}
          </td>
          <td className="px-3 py-3 align-top text-xs text-muted-foreground">
            <p>Qty {charge.quantity}</p>
            <p className="font-medium tabular-nums text-foreground">
              {formatUsd(charge.amountCents)}
            </p>
          </td>
          <td className="px-3 py-3 align-top">
            <StatusBadge kind={charge.inCart ? "inCart" : "awaitingPurchase"}>
              {charge.inCart ? "In cart" : "Top-up due"}
            </StatusBadge>
          </td>
          <td className="px-3 py-3 align-top text-xs text-muted-foreground">
            {charge.expiresAt ?
              <AbsoluteExpiryCountdownLabel
                expiresAt={charge.expiresAt}
                onExpired={() => router.refresh()}
              />
            : (
              <span className="text-xs text-muted-foreground/70">—</span>
            )}
          </td>
          <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
              Add-on
            </p>
            {charge.submittedAt ?
              <p className="mt-0.5 tabular-nums text-foreground">
                {new Date(charge.submittedAt).toLocaleString()}
              </p>
            : <p className="mt-0.5 text-muted-foreground/70">—</p>}
          </td>
          <td className={cn(appTableStickyActionsCell, "bg-primary/10")}>
            <div className="flex w-full max-w-[12.5rem] flex-col gap-1.5">
              <MerchandiseTopupChargePreviewDialog charge={charge} />
              {charge.inCart ?
                <Link
                  href="/dashboard/cart"
                  className={cn(
                    buttonVariants({ size: "sm", variant: "secondary" }),
                    "inline-flex",
                  )}
                >
                  <ShoppingCart className="size-3.5" aria-hidden />
                  View cart
                </Link>
              : <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => addToCart(charge.reconciliationId)}
                >
                  <ShoppingCart className="size-3.5" aria-hidden />
                  Add to cart
                </Button>
              }
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
