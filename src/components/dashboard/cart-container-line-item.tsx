import Link from "next/link";
import { Box } from "lucide-react";

import { ContainerCartRemoveButton } from "@/components/dashboard/container-cart-remove-button";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { formatUsd } from "@/lib/admin-markup";
import {
  allocateContainerPackingFeeToLineCents,
  containerPackingPerUnitCentsForKind,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";
import {
  containerOfferingKindLabel,
  type ContainerOfferingKind,
} from "@/lib/validations/container-offering";

export type CartContainerLineItemProps = {
  offeringId: string;
  name: string;
  kind: ContainerOfferingKind;
  sizeLabel: string;
  quantity: number;
  unitPriceCents: number;
  imageUrl: string | null;
  barrelCount: number;
  binCount: number;
  containerPackingRates: ContainerPackingRates;
};

export function CartContainerLineItem({
  offeringId,
  name,
  kind,
  sizeLabel,
  quantity,
  unitPriceCents,
  imageUrl,
  barrelCount,
  binCount,
  containerPackingRates,
}: CartContainerLineItemProps) {
  const containerSubtotalCents = unitPriceCents * quantity;
  const packagingPerUnitCents = containerPackingPerUnitCentsForKind(
    kind,
    barrelCount,
    binCount,
    containerPackingRates,
  );
  const packagingFeeCents = allocateContainerPackingFeeToLineCents({
    kind,
    quantity,
    barrelCount,
    binCount,
    rates: containerPackingRates,
  });
  const lineTotalCents = containerSubtotalCents + packagingFeeCents;

  const priceRows = [
    {
      label: "Container",
      detail: `${quantity} × ${formatUsd(unitPriceCents)}`,
      amountCents: containerSubtotalCents,
    },
    ...(packagingFeeCents > 0 ?
      [
        {
          label: "Packaging fee",
          detail: `${quantity} × ${formatUsd(packagingPerUnitCents)}`,
          amountCents: packagingFeeCents,
        },
      ]
    : []),
    {
      label: "Line total",
      amountCents: lineTotalCents,
      emphasis: true,
    },
  ];

  return (
    <li className="p-4 sm:p-5">
      <article className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ProductRequestThumbnail
          variant="cart"
          imageUrl={imageUrl}
          productLabel={name}
          className="ring-1 ring-border/40"
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <Box className="size-3 opacity-70" aria-hidden />
                  {containerOfferingKindLabel(kind)}
                </span>
                <span className="text-xs text-muted-foreground">{sizeLabel}</span>
              </div>
              <h3 className="text-base font-semibold leading-snug text-foreground">
                {name}
              </h3>
              <Link
                href="/dashboard/barrels"
                className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Change container
              </Link>
            </div>
            <div className="flex shrink-0 items-start gap-1 sm:flex-col sm:items-end">
              <p className="text-right">
                <span className="block text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatUsd(lineTotalCents)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {packagingFeeCents > 0 ? "incl. packaging" : "container only"}
                </span>
              </p>
              <ContainerCartRemoveButton offeringId={offeringId} />
            </div>
          </div>
          <CartLinePriceBreakdown rows={priceRows} />
        </div>
      </article>
    </li>
  );
}
