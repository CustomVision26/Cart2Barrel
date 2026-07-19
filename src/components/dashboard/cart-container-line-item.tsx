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
  transportationFeeUnitCents?: number;
  airlineName?: string;
  airlineBaggageFeeCents?: number;
  airlineBaggageFeeDetail?: string;
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
  transportationFeeUnitCents = 0,
  airlineName = "",
  airlineBaggageFeeCents = 0,
  airlineBaggageFeeDetail = "",
  imageUrl,
  barrelCount,
  binCount,
  containerPackingRates,
}: CartContainerLineItemProps) {
  const containerSubtotalCents = unitPriceCents * quantity;
  const transportationFeeCents = transportationFeeUnitCents * quantity;
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
  const lineTotalCents =
    containerSubtotalCents +
    transportationFeeCents +
    airlineBaggageFeeCents +
    packagingFeeCents;

  const airlineLabel = airlineName.trim();
  const baggageDetail =
    airlineBaggageFeeDetail.trim() || "Travel day checked bags";

  const containerRowLabel =
    kind === "suitcase" ? "Container (suitcase fee)" : "Container";

  const priceRows = [
    {
      label: containerRowLabel,
      detail: `${quantity} × ${formatUsd(unitPriceCents)}`,
      amountCents: containerSubtotalCents,
    },
    ...(transportationFeeCents > 0 ?
      [
        {
          label: "Transportation fee",
          detail: `${quantity} × ${formatUsd(transportationFeeUnitCents)}`,
          amountCents: transportationFeeCents,
        },
      ]
    : []),
    ...(airlineBaggageFeeCents > 0 ?
      [
        {
          label: airlineLabel ?
            `Airline baggage (${airlineLabel})`
          : "Airline baggage fee",
          detail: baggageDetail,
          amountCents: airlineBaggageFeeCents,
        },
      ]
    : []),
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

  const feeHintParts: string[] = [];
  if (transportationFeeCents > 0) feeHintParts.push("transportation");
  if (airlineBaggageFeeCents > 0) feeHintParts.push("baggage");
  if (packagingFeeCents > 0) feeHintParts.push("packaging");
  const feeHint =
    feeHintParts.length > 0 ?
      `incl. ${feeHintParts.join(" & ")}`
    : "container only";

  const trimmedName = name.trim();
  const trimmedSize = sizeLabel.trim();
  const showSizeAsTitle =
    kind === "suitcase" &&
    trimmedSize.length > 0 &&
    trimmedName.length > 0 &&
    trimmedName !== trimmedSize &&
    !trimmedName.startsWith(trimmedSize);
  const titlePrimary =
    showSizeAsTitle ? trimmedSize : trimmedName || trimmedSize || "Container";
  const titleSecondary = showSizeAsTitle ? trimmedName : null;

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
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    <Box className="size-3 opacity-70" aria-hidden />
                    {containerOfferingKindLabel(kind)}
                  </span>
                  {!showSizeAsTitle && trimmedSize ?
                    <span className="text-xs text-muted-foreground">{trimmedSize}</span>
                  : null}
                  {quantity > 1 ?
                    <span className="text-xs text-muted-foreground">Qty {quantity}</span>
                  : null}
                </div>
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  {titlePrimary}
                </h3>
              </div>
              <div className="flex shrink-0 items-start gap-1 sm:flex-col sm:items-end">
                <p className="text-right">
                  <span className="block text-xl font-semibold tabular-nums tracking-tight text-foreground">
                    {formatUsd(lineTotalCents)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{feeHint}</span>
                </p>
                <ContainerCartRemoveButton offeringId={offeringId} />
              </div>
              {titleSecondary ?
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:col-span-2">
                  {titleSecondary}
                </p>
              : null}
            </div>
            {airlineLabel ?
              <p className="text-xs text-muted-foreground">{airlineLabel}</p>
            : null}
            <Link
              href="/dashboard/barrels"
              className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Change container
            </Link>
          </div>
          <CartLinePriceBreakdown rows={priceRows} />
        </div>
      </article>
    </li>
  );
}
