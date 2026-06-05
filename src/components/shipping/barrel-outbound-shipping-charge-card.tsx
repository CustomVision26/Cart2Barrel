"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { addOutboundShippingChargeToCartAction } from "@/actions/user-outbound-shipping-cart";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import type { BarrelShippingIntakeSubmittedRow } from "@/lib/barrel-shipping-intake";
import {
  barrelShippingDeliveryMethodLabel,
  containerFullnessLabel,
} from "@/lib/barrel-shipping-intake";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

type BarrelOutboundShippingChargeCardProps = {
  row: BarrelShippingIntakeSubmittedRow;
};

export function BarrelOutboundShippingChargeCard({
  row,
}: BarrelOutboundShippingChargeCardProps) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const charge = row.outboundCharge;

  if (!charge || charge.paidAt) {
    return null;
  }

  function addToCart() {
    startTransition(async () => {
      const res = await addOutboundShippingChargeToCartAction({
        chargeId: charge!.chargeId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Added to cart.");
      router.refresh();
    });
  }

  return (
    <Card
      className={cn(
        "overflow-hidden bg-card shadow-sm",
        charge.inCart ?
          "border-primary/40 ring-1 ring-primary/30"
        : "border-border/80",
      )}
    >
      {charge.inCart ?
        <div className="flex items-center gap-1.5 border-b border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          <ShoppingCart className="size-3.5" aria-hidden />
          In your cart — checkout to pay
        </div>
      : null}
      <CardContent className="p-3">
        <article className="flex items-center gap-3">
          <ProductRequestThumbnail
            variant="list"
            imageUrl={row.containerImageUrl}
            productLabel={row.containerName}
            className="rounded-md ring-1 ring-border/40"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {row.containerName}
              </h3>
              {charge.inCart ?
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <ShoppingCart className="size-3" aria-hidden />
                  In cart
                </span>
              : null}
            </div>
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              Total due {formatUsd(charge.totalCents)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant={previewOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setPreviewOpen((open) => !open)}
            >
              <Eye className="size-3.5" aria-hidden />
              {previewOpen ? "Close" : "Preview"}
            </Button>
            {charge.inCart ?
              <Link
                href="/dashboard/cart"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground"
              >
                <ShoppingCart className="size-3.5" aria-hidden />
                In cart
              </Link>
            : (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={addToCart}
              >
                {pending ? "Adding…" : "Add to cart"}
              </Button>
            )}
          </div>
        </article>

        {previewOpen ?
          <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Container</dt>
                <dd className="text-foreground">
                  {row.alias} · {containerOfferingKindLabel(row.kind)}
                  <span className="mt-0.5 block text-muted-foreground">
                    {row.slotLabel} · {containerFullnessLabel(row)}
                  </span>
                  {row.itemCount > 0 ?
                    <span className="mt-0.5 block text-muted-foreground">
                      {row.itemCount} item{row.itemCount === 1 ? "" : "s"} packed
                    </span>
                  : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="text-foreground">
                  {new Date(row.submittedAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Delivery preference</dt>
                <dd className="text-foreground">
                  {barrelShippingDeliveryMethodLabel(row.deliveryMethod)}
                </dd>
              </div>
              {row.contactPhone ?
                <div>
                  <dt className="text-muted-foreground">Contact phone</dt>
                  <dd className="text-foreground">{row.contactPhone}</dd>
                </div>
              : null}
              {row.specialInstructions ?
                <div className={row.contactPhone ? "" : "sm:col-span-2"}>
                  <dt className="text-muted-foreground">Special instructions</dt>
                  <dd className="whitespace-pre-wrap text-foreground">
                    {row.specialInstructions}
                  </dd>
                </div>
              : null}
            </dl>

            <p className="text-xs text-muted-foreground">
              Pay these costs before we release your container to the courier.
            </p>

            <div className="overflow-hidden rounded-md border border-border/70 bg-background/50 text-xs">
              <ul className="divide-y divide-border/60">
                {charge.lines.map((line) => (
                  <li
                    key={line.label}
                    className="flex items-center justify-between gap-3 px-2.5 py-1.5"
                  >
                    <span className="text-foreground">{line.label}</span>
                    <span className="shrink-0 font-medium tabular-nums text-foreground">
                      {formatUsd(line.amountCents)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 bg-muted px-2.5 py-2">
                  <span className="font-semibold text-foreground">Total due</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatUsd(charge.totalCents)}
                  </span>
                </li>
              </ul>
            </div>

            {charge.adminNote ?
              <p className="rounded-md border border-border/60 bg-secondary px-2.5 py-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {charge.adminNote}
              </p>
            : null}
          </div>
        : null}
      </CardContent>
    </Card>
  );
}
