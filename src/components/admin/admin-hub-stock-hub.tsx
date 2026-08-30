"use client";

import Link from "next/link";

import {
  AdminHubShipFromAddresses,
  type AdminHubShipFromAddressRow,
} from "@/components/admin/admin-hub-ship-from-addresses";
import {
  AdminHubStockProductsManager,
  type AdminHubStockProductRow,
} from "@/components/admin/admin-hub-stock-products-manager";
import { cn } from "@/lib/utils";

export type HubStockSubTab = "addresses" | "products";

type AdminHubStockHubProps = {
  hubStockTab: HubStockSubTab;
  products: AdminHubStockProductRow[];
  shipFromAddresses: AdminHubShipFromAddressRow[];
  shippoConfigured: boolean;
};

function subTabHref(sub: HubStockSubTab): string {
  const params = new URLSearchParams({
    tab: "in-hub-products",
    hubStockTab: sub,
  });
  return `/admin/overview?${params.toString()}`;
}

export function AdminHubStockHub({
  hubStockTab,
  products,
  shipFromAddresses,
  shippoConfigured,
}: AdminHubStockHubProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b border-border">
        <Link
          href={subTabHref("addresses")}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            hubStockTab === "addresses"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Hub ship-from addresses
        </Link>
        <Link
          href={subTabHref("products")}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            hubStockTab === "products"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Add in-hub product
        </Link>
      </div>

      {hubStockTab === "addresses" ?
        <AdminHubShipFromAddresses
          addresses={shipFromAddresses}
          shippoConfigured={shippoConfigured}
          pending={false}
        />
      : <AdminHubStockProductsManager products={products} />}
    </div>
  );
}
