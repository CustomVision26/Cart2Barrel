"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  customerPillTabClass,
  customerPillTablistClass,
} from "@/lib/customer-pill-tabs";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import { cn } from "@/lib/utils";

export type DashboardShippingTab = "tracking" | "pricing" | "address" | "history";

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
    : path === DASHBOARD_SHIPPING_ROUTES.history ||
        path.startsWith(`${DASHBOARD_SHIPPING_ROUTES.history}/`)
      ? "history"
      : "tracking";

  return (
    <div
      role="tablist"
      aria-label="Shipping views"
      className={customerPillTablistClass}
    >
      <Link
        href={DASHBOARD_SHIPPING_ROUTES.tracking}
        role="tab"
        aria-selected={activeTab === "tracking"}
        className={customerPillTabClass(activeTab === "tracking")}
      >
        Shipment Tracking
      </Link>
      {showPricingTab ?
        <Link
          href={DASHBOARD_SHIPPING_ROUTES.pricing}
          role="tab"
          aria-selected={activeTab === "pricing"}
          className={cn(
            customerPillTabClass(activeTab === "pricing"),
            "gap-1.5",
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
        className={customerPillTabClass(activeTab === "address")}
      >
        Profile &amp; Address
      </Link>
      <Link
        href={DASHBOARD_SHIPPING_ROUTES.history}
        role="tab"
        aria-selected={activeTab === "history"}
        className={customerPillTabClass(activeTab === "history")}
      >
        Shipping History
      </Link>
    </div>
  );
}
