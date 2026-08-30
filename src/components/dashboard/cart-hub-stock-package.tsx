"use client";

import { useState } from "react";
import { Package, Warehouse } from "lucide-react";

import { CartHubStockLineItem } from "@/components/dashboard/cart-hub-stock-line-item";
import { CartHubStockShippingRatesButton } from "@/components/dashboard/cart-hub-stock-shipping-rates-button";
import { HubStockCartChangeAddressButton } from "@/components/dashboard/hub-stock-cart-change-address-button";
import type { SerializableShippingAddress } from "@/data/addresses";
import type { HubStockCartPackage } from "@/data/hub-stock-cart";
import { formatHubStockUsAddress } from "@/lib/hub-stock";

export function CartHubStockPackage({
  pkg,
  savedAddresses,
}: {
  pkg: HubStockCartPackage;
  savedAddresses: SerializableShippingAddress[];
}) {
  const [showAddress, setShowAddress] = useState(false);
  const first = pkg.lines[0]?.cartItem;
  const address =
    pkg.destination === "us_address" && first
      ? formatHubStockUsAddress({
          line1: first.shipLine1,
          line2: first.shipLine2,
          city: first.shipCity,
          state: first.shipState,
          postalCode: first.shipPostalCode,
          country: first.shipCountry,
        })
      : null;
  const productCount = pkg.lines.reduce(
    (sum, line) => sum + line.cartItem.quantity,
    0,
  );
  const isUsPackage = pkg.destination === "us_address";

  return (
    <li className="space-y-0">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-primary/20 bg-primary/10 px-3 py-2.5">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            {isUsPackage ?
              <Package className="size-3.5 shrink-0" aria-hidden />
            : <Warehouse className="size-3.5 shrink-0" aria-hidden />}
            {isUsPackage ?
              pkg.lines.length > 1 ?
                "Warehouse package"
              : "Warehouse item"
            : "Overseas hub packing"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isUsPackage ?
              `${pkg.lines.length} in-hub ${pkg.lines.length === 1 ? "product" : "products"} · ${productCount} ${productCount === 1 ? "unit" : "units"} packed together`
            : "Packed into your overseas container at the hub. No US carrier shipping."}
          </p>
          {address ?
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
              <button
                type="button"
                className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setShowAddress((open) => !open)}
              >
                {showAddress ? "Hide shipping address" : "View shipping address"}
              </button>
              {first ?
                <HubStockCartChangeAddressButton
                  cartItemId={first.id}
                  addresses={savedAddresses}
                />
              : null}
            </div>
          : null}
          {address && showAddress ?
            <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
              {address}
            </p>
          : null}
        </div>
        {isUsPackage && first ?
          <CartHubStockShippingRatesButton
            cartItemId={first.id}
            selectedCents={pkg.shippingCents}
            selectedCarrier={pkg.shippingCarrier}
            selectedService={pkg.shippingService}
          />
        : null}
      </div>
      <ul className="divide-y divide-primary/15" role="list">
        {pkg.lines.map(({ cartItem, product, imageUrl }) => (
          <CartHubStockLineItem
            key={cartItem.id}
            cartItemId={cartItem.id}
            name={product.name}
            sizeLabel={product.sizeLabel}
            colorLabel={product.colorLabel}
            quantity={cartItem.quantity}
            unitPriceCents={product.priceUsdCents}
            destination={cartItem.destination}
            shipLine1={cartItem.shipLine1}
            shipLine2={cartItem.shipLine2}
            shipCity={cartItem.shipCity}
            shipState={cartItem.shipState}
            shipPostalCode={cartItem.shipPostalCode}
            shipCountry={cartItem.shipCountry}
            imageUrl={imageUrl}
            savedAddresses={savedAddresses}
            shippingCents={0}
            shippingCarrier={null}
            shippingService={null}
            hideShipping
            hideAddress
          />
        ))}
      </ul>
    </li>
  );
}
