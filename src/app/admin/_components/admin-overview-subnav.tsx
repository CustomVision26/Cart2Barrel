"use client";

import Link from "next/link";

import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { cn } from "@/lib/utils";

export type AdminOverviewTab =
  | "summary"
  | "finance"
  | "set-fee-n-rate"
  | "customer-packages"
  | "shipping-containers";

const tabs: { id: AdminOverviewTab; label: string; extra?: Record<string, string> }[] =
  [
    { id: "summary", label: "Summary" },
    { id: "finance", label: "Finance" },
    { id: "set-fee-n-rate", label: "Fees & rates" },
    { id: "customer-packages", label: "Customer packages" },
    { id: "shipping-containers", label: "Shipping containers" },
  ];

export function AdminOverviewSubnav({ active }: { active: AdminOverviewTab }) {
  const { hrefWithFilter } = useAdminCustomerFilter();

  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map(({ id, label, extra }) => (
        <Link
          key={id}
          href={hrefWithFilter("/admin/overview", { tab: id, ...extra })}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
            active === id
              ? "border-border border-b-background bg-background text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
