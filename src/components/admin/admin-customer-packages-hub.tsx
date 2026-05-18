"use client";

import Link from "next/link";

import { AdminCustomerPackagesListPanel } from "@/components/admin/admin-customer-packages-list-panel";
import { AdminCustomerPricingPackagesPanel } from "@/components/admin/admin-customer-pricing-packages-panel";
import { AdminGeneralPackageFeePanel } from "@/components/admin/admin-general-package-fee-panel";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import type { CustomerPricingPackageListRow } from "@/data/customer-pricing-packages";
import type { CustomerPricingPackageSnapshot } from "@/data/customer-pricing-packages";
import type { MerchantPricingEstimateSnapshot } from "@/data/merchant-pricing-settings";
import type { ContainerPackingRates } from "@/lib/container-packing-fee";
import { cn } from "@/lib/utils";

export type CustomerPackagesSubTab = "general" | "customer" | "saved";

type AdminCustomerPackagesHubProps = {
  packageTab: CustomerPackagesSubTab;
  initialPackingFeePerLineCents: number;
  initialContainerPackingRates: ContainerPackingRates;
  users: AdminProfilePickerRow[];
  savedPackages: CustomerPricingPackageListRow[];
  selectedClerkUserId?: string;
  globalPricing: MerchantPricingEstimateSnapshot;
  customerPackage: CustomerPricingPackageSnapshot | null;
};

function subTabHref(
  sub: CustomerPackagesSubTab,
  selectedClerkUserId?: string,
): string {
  const params = new URLSearchParams({
    tab: "customer-packages",
    packageTab: sub,
  });
  if (sub === "customer" && selectedClerkUserId) {
    params.set("userId", selectedClerkUserId);
  }
  return `/admin/overview?${params.toString()}`;
}

export function AdminCustomerPackagesHub({
  packageTab,
  initialPackingFeePerLineCents,
  initialContainerPackingRates,
  users,
  savedPackages,
  selectedClerkUserId,
  globalPricing,
  customerPackage,
}: AdminCustomerPackagesHubProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b border-border">
        <Link
          href={subTabHref("general")}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            packageTab === "general"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          General package fee
        </Link>
        <Link
          href={subTabHref("customer", selectedClerkUserId)}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            packageTab === "customer"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          Select customer
        </Link>
        <Link
          href={subTabHref("saved")}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            packageTab === "saved"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          Saved packages
        </Link>
      </div>

      {packageTab === "general" ?
        <AdminGeneralPackageFeePanel
          initialPackingFeePerLineCents={initialPackingFeePerLineCents}
          initialContainerPackingRates={initialContainerPackingRates}
        />
      : packageTab === "saved" ?
        <AdminCustomerPackagesListPanel packages={savedPackages} />
      : <AdminCustomerPricingPackagesPanel
          users={users}
          selectedClerkUserId={selectedClerkUserId}
          globalPricing={globalPricing}
          customerPackage={customerPackage}
        />
      }
    </div>
  );
}
