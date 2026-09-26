"use client";

import { useEffect, useState } from "react";

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

function syncExpiryTabUrl(
  sub: QuoteExpirySubTab,
  selectedClerkUserId?: string,
) {
  if (typeof window === "undefined") return;
  window.history.replaceState(
    window.history.state,
    "",
    subTabHref(sub, selectedClerkUserId),
  );
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
  const [tab, setTab] = useState<QuoteExpirySubTab>(expiryTab);

  useEffect(() => {
    setTab(expiryTab);
  }, [expiryTab]);

  function goTo(sub: QuoteExpirySubTab) {
    setTab(sub);
    syncExpiryTabUrl(sub, selectedClerkUserId);
  }

  const tabClass = (sub: QuoteExpirySubTab) =>
    cn(
      "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
      tab === sub
        ? "border-border border-b-background bg-background text-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Set how long a quoted price stays valid, or turn on{" "}
        <span className="font-medium text-foreground">Do not expire quotes</span>{" "}
        so that layer has no accept/pay deadline. Priority is{" "}
        <span className="font-medium text-foreground">Product</span>, then{" "}
        <span className="font-medium text-foreground">Customer</span>, then{" "}
        <span className="font-medium text-foreground">Hub</span>. Changes apply
        immediately to open quoted products (single lines and batch lines).
      </p>

      <div
        role="tablist"
        aria-label="Quote expiry level"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "hub"}
          className={tabClass("hub")}
          onClick={() => goTo("hub")}
        >
          Hub
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "customer"}
          className={tabClass("customer")}
          onClick={() => goTo("customer")}
        >
          Customer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "product"}
          className={tabClass("product")}
          onClick={() => goTo("product")}
        >
          Product
        </button>
      </div>

      {tab === "hub" ?
        <AdminQuoteExpirySettingsPanel
          initialExpiryMinutes={hubExpiryMinutes}
          updatedAt={hubUpdatedAt}
        />
      : tab === "customer" ?
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
