import Link from "next/link";

import { cn } from "@/lib/utils";

export type AdminOverviewTab =
  | "summary"
  | "finance"
  | "set-fee-n-rate"
  | "shipping-containers";

export function AdminOverviewSubnav({ active }: { active: AdminOverviewTab }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      <Link
        href="/admin/overview?tab=summary"
        className={cn(
          "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
          active === "summary"
            ? "border-border border-b-background bg-background text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        Summary
      </Link>
      <Link
        href="/admin/overview?tab=finance"
        className={cn(
          "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
          active === "finance"
            ? "border-border border-b-background bg-background text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        Finance
      </Link>
      <Link
        href="/admin/overview?tab=set-fee-n-rate"
        className={cn(
          "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
          active === "set-fee-n-rate"
            ? "border-border border-b-background bg-background text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        Fees &amp; rates
      </Link>
      <Link
        href="/admin/overview?tab=shipping-containers"
        className={cn(
          "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
          active === "shipping-containers"
            ? "border-border border-b-background bg-background text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        Shipping containers
      </Link>
    </div>
  );
}
