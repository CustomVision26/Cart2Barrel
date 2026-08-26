import { MapPin, Package, Warehouse } from "lucide-react";

import { CartCheckoutProductDetail } from "@/components/dashboard/cart-checkout-product-detail";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import type { CartCheckoutHubStockPackage } from "@/data/hub-stock-checkout-summary";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export function CartCheckoutHubStockPackageCard({
  pkg,
  compact = false,
}: {
  pkg: CartCheckoutHubStockPackage;
  compact?: boolean;
}) {
  const isUsPackage = pkg.destination === "us_address";
  const productCount = pkg.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-primary/45 bg-primary/8 shadow-sm",
        compact ? "ring-1 ring-primary/25" : "ring-2 ring-primary/25",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-2 border-b border-primary/20 bg-primary/10",
          compact ? "px-3.5 py-2.5" : "px-4 py-3",
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            {isUsPackage ?
              <Package className="size-3.5 shrink-0" aria-hidden />
            : <Warehouse className="size-3.5 shrink-0" aria-hidden />}
            {isUsPackage ?
              pkg.lines.length > 1 ?
                "In-hub warehouse package"
              : "In-hub warehouse item"
            : "Overseas hub packing"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isUsPackage ?
              `${pkg.lines.length} in-hub ${pkg.lines.length === 1 ? "product" : "products"} · ${productCount} ${productCount === 1 ? "unit" : "units"} packed together`
            : "Packed into your overseas container at the hub. No US carrier shipping."}
          </p>
          {isUsPackage && pkg.shipToLabel ?
            <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-snug text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium text-foreground">Ship to</span>
                {": "}
                {pkg.shipToLabel}
              </span>
            </p>
          : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Package total
          </p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {formatUsd(pkg.packageTotalCents)}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-primary/15" role="list">
        {pkg.lines.map((line) => (
          <li
            key={line.itemRequestId}
            className={cn(
              "flex items-start justify-between gap-3",
              compact ? "px-3.5 py-2.5" : "flex-col gap-2 px-4 py-3 sm:flex-row",
            )}
          >
            <div className="min-w-0 space-y-0.5">
              {compact ? null : (
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-primary">
                  In-hub catalog
                </p>
              )}
              <p className="break-words text-sm font-medium leading-snug text-foreground">
                {line.productName?.trim() || "Product"}
                {line.quantity > 1 ?
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ×{line.quantity}
                  </span>
                : null}
              </p>
              <CartCheckoutProductDetail detail={line.productReferenceDetail} />
            </div>
            <p
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums text-foreground",
                !compact && "sm:pt-4 sm:text-right",
              )}
            >
              {formatUsd(line.merchandiseCents)}
            </p>
          </li>
        ))}
      </ul>
      <div
        className={cn(
          "border-t border-primary/20",
          compact ? "space-y-1.5 px-3.5 py-2.5" : "px-4 py-3",
        )}
      >
        {compact ?
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Merchandise</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatUsd(pkg.merchandiseCents)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 text-muted-foreground">
                <span className="font-medium text-foreground">Shipping</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground/90">
                  {isUsPackage ?
                    pkg.shippingLabel || "US carrier rate"
                  : "Included in overseas container"}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatUsd(isUsPackage ? pkg.shippingCents : 0)}
              </span>
            </div>
          </>
        : (
          <CartLinePriceBreakdown
            rows={[
              {
                label: "In-hub products",
                detail: `${pkg.lines.length} ${pkg.lines.length === 1 ? "line" : "lines"}`,
                amountCents: pkg.merchandiseCents,
              },
              ...(isUsPackage ?
                [
                  {
                    label: "Package shipping",
                    detail: pkg.shippingLabel || "US carrier rate",
                    amountCents: pkg.shippingCents,
                    emphasis: true,
                  },
                ]
              : [
                  {
                    label: "US shipping",
                    detail: "Included in overseas container",
                    amountCents: 0,
                  },
                ]),
            ]}
          />
        )}
      </div>
    </div>
  );
}
