"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import { cn } from "@/lib/utils";

export type DashboardShippingTab = "tracking" | "pricing" | "address";

const tabLinkClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

type DashboardShippingTabNavProps = {
  showPricingTab: boolean;
  pricingNeedsAttention?: boolean;
};

export function DashboardShippingTabNav({
  showPricingTab,
  pricingNeedsAttention = false,
}: DashboardShippingTabNavProps) {
  const path = usePathname() ?? "";

  const activeTab: DashboardShippingTab =
    path === DASHBOARD_SHIPPING_ROUTES.address ||
    path.startsWith(`${DASHBOARD_SHIPPING_ROUTES.address}/`)
      ? "address"
    : path === DASHBOARD_SHIPPING_ROUTES.pricing ||
        path.startsWith(`${DASHBOARD_SHIPPING_ROUTES.pricing}/`)
      ? "pricing"
      : "tracking";

  return (
    <div
      role="tablist"
      aria-label="Shipping views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={DASHBOARD_SHIPPING_ROUTES.tracking}
        role="tab"
        aria-selected={activeTab === "tracking"}
        className={tabLinkClass(activeTab === "tracking")}
      >
        Shipment tracking
      </Link>
      {showPricingTab ?
        <Link
          href={DASHBOARD_SHIPPING_ROUTES.pricing}
          role="tab"
          aria-selected={activeTab === "pricing"}
          className={cn(
            tabLinkClass(activeTab === "pricing"),
            "inline-flex items-center gap-1.5",
          )}
        >
          Pricing
          {pricingNeedsAttention ?
            <span
              className="size-2 rounded-full bg-amber-500"
              aria-label="Charges ready to pay"
            />
          : null}
        </Link>
      : null}
      <Link
        href={DASHBOARD_SHIPPING_ROUTES.address}
        role="tab"
        aria-selected={activeTab === "address"}
        className={tabLinkClass(activeTab === "address")}
      >
        Profile &amp; address
      </Link>
    </div>
  );
}
