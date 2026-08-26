"use client";

import { useState } from "react";
import { Warehouse } from "lucide-react";

import { HubStockCartRemoveButton } from "@/components/dashboard/hub-stock-cart-remove-button";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import { HubStockCartChangeAddressButton } from "@/components/dashboard/hub-stock-cart-change-address-button";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import type { SerializableShippingAddress } from "@/data/addresses";
import { formatUsd } from "@/lib/admin-markup";
import {
  formatHubStockUsAddress,
  hubStockDestinationLabel,
} from "@/lib/hub-stock";
import type { HubStockDestinationInput } from "@/lib/validations/hub-stock";

export function CartHubStockLineItem({
  cartItemId,
  name,
  sizeLabel,
  colorLabel,
  quantity,
  unitPriceCents,
  destination,
  shipLine1,
  shipLine2,
  shipCity,
  shipState,
  shipPostalCode,
  shipCountry,
  imageUrl,
  savedAddresses,
  shippingCents,
  shippingCarrier,
  shippingService,
  hideShipping = false,
  hideAddress = false,
}: {
  cartItemId: string;
  name: string;
  sizeLabel: string;
  colorLabel: string;
  quantity: number;
  unitPriceCents: number;
  destination: HubStockDestinationInput;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
  imageUrl?: string | null;
  savedAddresses: SerializableShippingAddress[];
  shippingCents: number;
  shippingCarrier: string | null;
  shippingService: string | null;
  hideShipping?: boolean;
  hideAddress?: boolean;
}) {
  const [showAddress, setShowAddress] = useState(false);
  const productCents = unitPriceCents * quantity;
  const usShippingCents =
    destination === "us_address" ? Math.max(0, shippingCents) : 0;
  const shippingLabel = [shippingCarrier, shippingService]
    .filter((part) => Boolean(part?.trim()))
    .join(" ");
  const destLabel = hubStockDestinationLabel(destination);
  const address =
    destination === "us_address"
      ? formatHubStockUsAddress({
          line1: shipLine1,
          line2: shipLine2,
          city: shipCity,
          state: shipState,
          postalCode: shipPostalCode,
          country: shipCountry,
        })
      : null;

  return (
    <li className="flex flex-col gap-2 px-1 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-2.5">
        {imageUrl?.trim() ?
          <ProductRequestThumbnail
            imageUrl={imageUrl}
            productLabel={name}
            variant="list"
          />
        : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary">
            <Warehouse className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            Size {sizeLabel} · Color {colorLabel} · Qty {quantity}
          </p>
          <p className="text-[11px] text-muted-foreground">
            In-hub · {destLabel}
          </p>
          {address && !hideAddress ?
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
              <button
                type="button"
                className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setShowAddress((open) => !open)}
              >
                {showAddress ? "Hide shipping address" : "View shipping address"}
              </button>
              <HubStockCartChangeAddressButton
                cartItemId={cartItemId}
                addresses={savedAddresses}
              />
            </div>
          : null}
          {address && !hideAddress && showAddress ?
            <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
              {address}
            </p>
          : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:w-48">
        <CartLinePriceBreakdown
          rows={[
            {
              label: "In-hub product",
              detail: `${quantity} × ${formatUsd(unitPriceCents)}`,
              amountCents: productCents,
              emphasis: hideShipping || usShippingCents === 0,
            },
            ...(!hideShipping && usShippingCents > 0 ?
              [
                {
                  label: "US shipping",
                  detail: shippingLabel || "Carrier rate",
                  amountCents: usShippingCents,
                  emphasis: true,
                },
              ]
            : []),
          ]}
        />
        <HubStockCartRemoveButton cartItemId={cartItemId} />
      </div>
    </li>
  );
}
