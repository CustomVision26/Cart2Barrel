"use client";

import Link from "next/link";

import { AdminCustomerQuoteExpiryPanel } from "@/components/admin/admin-customer-quote-expiry-panel";
import { AdminProductQuoteExpiryPanel } from "@/components/admin/admin-product-quote-expiry-panel";
import { AdminQuoteExpirySettingsPanel } from "@/components/admin/admin-quote-expiry-settings-panel";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import type {
  AdminQuotedProductExpiryRow,
  CustomerQuoteExpiryOverrideRow,
} from "@/data/quote-expiry-settings";
import { cn } from "@/lib/utils";

export type QuoteExpirySubTab = "hub" | "customer" | "product";

type AdminQuoteExpiryHubProps = {
  expiryTab: QuoteExpirySubTab;
  selectedClerkUserId?: string;
  hubExpiryMinutes: number;
  hubUpdatedAt: string | null;
  users: AdminProfilePickerRow[];
  customerOverrides: CustomerQuoteExpiryOverrideRow[];
  selectedCustomerOverrideMinutes: number | null;
  productRows: AdminQuotedProductExpiryRow[];
};

function subTabHref(
  sub: QuoteExpirySubTab,
  selectedClerkUserId?: string,
): string {
  const params = new URLSearchParams({
    tab: "quote-expiry",
    expiryTab: sub,
  });
  if ((sub === "customer" || sub === "product") && selectedClerkUserId) {
    params.set("userId", selectedClerkUserId);
  }
  return `/admin/overview?${params.toString()}`;
}

export function AdminQuoteExpiryHub({
  expiryTab,
  selectedClerkUserId,
  hubExpiryMinutes,
  hubUpdatedAt,
  users,
  customerOverrides,
  selectedCustomerOverrideMinutes,
  productRows,
}: AdminQuoteExpiryHubProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Set how long a quoted price stays valid. Priority is{" "}
        <span className="font-medium text-foreground">Product</span>, then{" "}
        <span className="font-medium text-foreground">Customer</span>, then{" "}
        <span className="font-medium text-foreground">Hub</span>. Changes apply
        immediately to open quoted products (single lines and batch lines).
      </p>

      <div className="flex flex-wrap gap-1 border-b border-border">
        <Link
          href={subTabHref("hub")}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            expiryTab === "hub"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Hub
        </Link>
        <Link
          href={subTabHref("customer", selectedClerkUserId)}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            expiryTab === "customer"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Customer
        </Link>
        <Link
          href={subTabHref("product", selectedClerkUserId)}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            expiryTab === "product"
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Product
        </Link>
      </div>

      {expiryTab === "hub" ?
        <AdminQuoteExpirySettingsPanel
          initialExpiryMinutes={hubExpiryMinutes}
          updatedAt={hubUpdatedAt}
        />
      : expiryTab === "customer" ?
        <AdminCustomerQuoteExpiryPanel
          users={users}
          overrides={customerOverrides}
          selectedClerkUserId={selectedClerkUserId}
          globalExpiryMinutes={hubExpiryMinutes}
          selectedOverrideMinutes={selectedCustomerOverrideMinutes}
        />
      : <AdminProductQuoteExpiryPanel
          users={users}
          initialOverrides={productRows}
          globalExpiryMinutes={hubExpiryMinutes}
          selectedClerkUserId={selectedClerkUserId}
        />
      }
    </div>
  );
}
