import Link from "next/link";

import { cn } from "@/lib/utils";

export type AdminOverviewTab = "summary" | "finance";

export function AdminOverviewSubnav({ active }: { active: AdminOverviewTab }) {
  return (
    <div className="flex gap-1 border-b border-border">
      <Link
        href="/admin"
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
        href="/admin?tab=finance"
        className={cn(
          "-mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
          active === "finance"
            ? "border-border border-b-background bg-background text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        Finance
      </Link>
    </div>
  );
}
